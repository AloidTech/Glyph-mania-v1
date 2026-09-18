/**
 * @file model_trainer.ts
 * @description Machine Learning Classifier Trainer & Predictor.
 * Handles TensorFlow.js training dataset preparation, model compilation,
 * training loop with real-time Zustand progress updates, and prediction
 * using serialized neural network weights.
 */

import * as tf from '@tensorflow/tfjs';
import { useTrainingStore, SerializedWeight } from './training_store';

export interface TrainingOptions {
  limitExamplesPerClass?: boolean; // When true, caps examples per class
  maxExamplesPerClass?: number; // Default: 50
  balanceClasses?: boolean; // When true, oversamples smaller classes to equal size
  epochs?: number;
  batchSize?: number;
}

export function getAllTrainingDataset(options?: {
  limitExamplesPerClass?: boolean;
  maxExamplesPerClass?: number;
  balanceClasses?: boolean;
}) {
  const limitEnabled = options?.limitExamplesPerClass ?? true;
  const maxPerClass = options?.maxExamplesPerClass ?? 50;
  const balanceClasses = options?.balanceClasses ?? true;

  const examples = useTrainingStore.getState().examples;
  const entries = Object.entries(examples).filter(([, vals]) => vals.length > 0);

  if (entries.length === 0) return [];

  // Target sample count per class (capped to maxPerClass if limit enabled)
  const classCounts = entries.map(([, vals]) =>
    limitEnabled ? Math.min(vals.length, maxPerClass) : vals.length
  );
  const targetCount = balanceClasses
    ? Math.max(...classCounts, 10)
    : Math.max(...classCounts);

  const trainingDataset: { symbol: string; vector: number[] }[] = [];

  for (const [symbol, values] of entries) {
    const selectedValues = limitEnabled ? values.slice(-maxPerClass) : values;
    if (selectedValues.length === 0) continue;

    // 1. Add recorded examples
    for (const ex of selectedValues) {
      trainingDataset.push({
        symbol,
        vector: ex.vec,
      });
    }

    // 2. Random oversampling with slight numeric jitter so all classes have equal representation
    if (balanceClasses && selectedValues.length < targetCount) {
      const needed = targetCount - selectedValues.length;
      for (let i = 0; i < needed; i++) {
        const randomSample = selectedValues[Math.floor(Math.random() * selectedValues.length)];
        // Add slight noise (jitter +/- 0.015) to embeddings to prevent exact duplicate memorization
        const jitteredVec = randomSample.vec.map((val) => {
          const noise = (Math.random() - 0.5) * 0.025;
          return val + noise;
        });
        trainingDataset.push({
          symbol,
          vector: jitteredVec,
        });
      }
    }
  }

  return trainingDataset;
}

export function getSymbolMap() {
  const examples = useTrainingStore.getState().examples;
  const symbols = Object.keys(examples);
  const symbolMap = new Map<string, number>();

  symbols.forEach((symbol, index) => {
    symbolMap.set(symbol, index + 1);
  });

  return symbolMap;
}

let activeModel: tf.Sequential | null = null;

export function stopTraining() {
  if (activeModel) {
    activeModel.stopTraining = true;
    console.log('Training cancellation requested.');
  }
}

export async function trainModel(options?: TrainingOptions) {
  const limitEnabled = options?.limitExamplesPerClass ?? true;
  const maxPerClass = options?.maxExamplesPerClass ?? 50;
  const balanceClasses = options?.balanceClasses ?? true;

  const store = useTrainingStore.getState();
  const trainingDataset = getAllTrainingDataset({
    limitExamplesPerClass: limitEnabled,
    maxExamplesPerClass: maxPerClass,
    balanceClasses: balanceClasses,
  });
  const symbolMap = getSymbolMap();
  const numClasses = symbolMap.size + 1;

  const validData = trainingDataset.filter((item) => symbolMap.has(item.symbol));

  if (validData.length === 0) {
    const errorMsg = 'No valid training data found. Please add examples before training.';
    console.warn(errorMsg);
    store.setTrainingError(errorMsg);
    store.setIsTraining(false);
    return;
  }

  // Adaptive fitting parameters according to dataset size
  const totalSamples = validData.length;
  // Dynamic batch size: adapt between 8 and 24 based on sample count
  const batchSize = options?.batchSize ?? Math.min(24, Math.max(8, Math.floor(totalSamples / 10)));
  const totalEpochs = options?.epochs ?? 35;

  store.setIsTraining(true);
  store.setTrainingError(null);
  store.setTrainingProgress({ epoch: 0, totalEpochs, loss: 0, accuracy: 0 });

  const embeddingsArray = validData.map((item) => item.vector);
  const labelsArray = validData.map((item) => symbolMap.get(item.symbol) ?? 0);

  const xs = tf.tensor2d(embeddingsArray);
  const ys = tf.oneHot(tf.tensor1d(labelsArray, 'int32'), numClasses);

  const model = tf.sequential();
  activeModel = model;

  model.add(
    tf.layers.dense({
      inputShape: [512],
      units: 64, // Compresses 512 features into 64 key patterns
      activation: 'relu',
      kernelRegularizer: tf.regularizers.l2({ l2: 1e-4 }), // Weight decay prevents overfitting
    })
  );

  model.add(tf.layers.dropout({ rate: 0.25 })); // Prevents memorization of exact training features

  model.add(
    tf.layers.dense({
      units: numClasses, // Output node for every symbol type
      activation: 'softmax', // Output probability distribution summing to 1
    })
  );

  model.compile({
    optimizer: tf.train.adam(0.001),
    loss: 'categoricalCrossentropy',
    metrics: ['accuracy'],
  });

  // Warn user if they attempt to refresh or close tab while training
  const handleBeforeUnload = (e: BeforeUnloadEvent) => {
    e.preventDefault();
    e.returnValue = '';
  };
  window.addEventListener('beforeunload', handleBeforeUnload);

  const epochHistory: { epoch: number; loss: number; accuracy: number }[] = [];

  try {
    await model.fit(xs, ys, {
      epochs: totalEpochs,
      batchSize: batchSize,
      shuffle: true,
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          const currentEpoch = epoch + 1;
          const loss = logs?.loss ?? 0;
          // TensorFlow.js may report accuracy under 'acc' or 'accuracy'
          const accuracy = (logs?.acc !== undefined ? logs.acc : logs?.accuracy) ?? 0;
          console.log(
            `Epoch ${currentEpoch}/${totalEpochs}: loss = ${loss.toFixed(4)}, accuracy = ${(
              accuracy * 100
            ).toFixed(1)}%`
          );

          const point = {
            epoch: currentEpoch,
            loss,
            accuracy,
          };
          epochHistory.push(point);

          // Update Zustand store in real time from callback
          useTrainingStore.getState().setTrainingProgress({
            epoch: currentEpoch,
            totalEpochs,
            loss,
            accuracy,
          });
          useTrainingStore.getState().setTrainingHistory([...epochHistory]);
        },
      },
    });

    if (model.stopTraining) {
      console.log('Training was stopped early. Discarding incomplete weights.');
      return;
    }

    // Extract and serialize weights to standard JSON-compatible arrays
    const serializedWeights = await Promise.all(
      model.getWeights().map(async (w, idx) => ({
        name: `weight_${idx}`,
        shape: Array.from(w.shape),
        values: Array.from(await w.data()),
      }))
    );

    // Class index 0 is __unknown__, 1..N are the registered symbols
    const classLabels = ['__unknown__', ...Array.from(symbolMap.keys())];

    // Save weights & class mapping to Zustand store as an unsaved new model
    useTrainingStore.getState().setSavedWeights(serializedWeights, classLabels, true);
    useTrainingStore.getState().setTrainingHistory(epochHistory);
    console.log('Model weights and training history saved to Zustand store successfully (marked unsaved).');
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Training failed unexpectedly.';
    console.error('Error during model training:', err);
    useTrainingStore.getState().setTrainingError(errorMsg);
  } finally {
    window.removeEventListener('beforeunload', handleBeforeUnload);
    activeModel = null;
    useTrainingStore.getState().setIsTraining(false);
    xs.dispose();
    ys.dispose();
  }
}

export interface PredictionOptions {
  allowedClasses?: string[];
  excludedClasses?: string[];
}

/**
 * Predict using the trained neural network weights saved in Zustand.
 * Supports selective class filtering (inclusion or exclusion).
 */
export function predictWithTrainedModel(
  vector: number[] | Float32Array,
  savedWeights: SerializedWeight[],
  trainedClassLabels: string[],
  options?: PredictionOptions
): { label: string | null; confidences: Record<string, number>; rawSimilarity: number } {
  const numClasses = trainedClassLabels.length;
  const model = tf.sequential();
  model.add(
    tf.layers.dense({
      inputShape: [512],
      units: 64,
      activation: 'relu',
    })
  );
  model.add(tf.layers.dropout({ rate: 0.25 }));
  model.add(
    tf.layers.dense({
      units: numClasses,
      activation: 'softmax',
    })
  );

  const weightTensors = savedWeights.map((w) => tf.tensor(w.values, w.shape));
  model.setWeights(weightTensors);

  let probs: number[] = [];
  const inputTensor = tf.tensor2d([Array.from(vector)], [1, 512]);
  try {
    const outputTensor = model.predict(inputTensor) as tf.Tensor;
    probs = Array.from(outputTensor.dataSync());
    outputTensor.dispose();
  } finally {
    inputTensor.dispose();
    weightTensors.forEach((t) => t.dispose());
    model.dispose();
  }

  const confidences: Record<string, number> = {};
  let bestLabel: string | null = null;
  let maxProb = -1;

  trainedClassLabels.forEach((label, idx) => {
    if (label !== '__unknown__') {
      const prob = probs[idx] ?? 0;
      confidences[label] = prob;

      // Selective filtering: skip excluded classes or classes not in allowed list
      if (options?.excludedClasses && options.excludedClasses.includes(label)) {
        return;
      }
      if (
        options?.allowedClasses &&
        options.allowedClasses.length > 0 &&
        !options.allowedClasses.includes(label)
      ) {
        return;
      }

      if (prob > maxProb) {
        maxProb = prob;
        bestLabel = label;
      }
    }
  });

  return {
    label: bestLabel,
    confidences,
    rawSimilarity: maxProb,
  };
}
