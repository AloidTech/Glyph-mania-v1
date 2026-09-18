import * as tf from '@tensorflow/tfjs';

let embeddingModel: tf.LayersModel | null = null;
let isModelLoading = false;
let modelLoadPromise: Promise<tf.LayersModel> | null = null;

export async function getOrLoadEmbeddingModel(): Promise<tf.LayersModel> {
  if (embeddingModel) return embeddingModel;
  if (modelLoadPromise) return modelLoadPromise;

  modelLoadPromise = (async () => {
    isModelLoading = true;
    try {
      const fullModel = await tf.loadLayersModel('/models/quickdraw/model.json');

      // Build a clean functional sub-model by chaining layers up to and including 'dense'
      // to extract the 512-dim embedding layer
      const inputLayer = tf.input({ shape: [28, 28, 1] });
      let x = inputLayer;
      for (const layer of fullModel.layers) {
        x = layer.apply(x) as tf.SymbolicTensor;
        if (layer.name === 'dense') break; // 512-dim embedding layer
      }

      embeddingModel = tf.model({ inputs: inputLayer, outputs: x });

      // Warmup inference
      const warm = tf.zeros([1, 28, 28, 1]);
      const w = embeddingModel.predict(warm) as tf.Tensor;
      const shape = w.shape;
      w.dispose();
      warm.dispose();

      if (shape[shape.length - 1] !== 512) {
        throw new Error(`Unexpected embedding shape: ${shape.join(',')}`);
      }

      console.log('QuickDraw CNN embedding model initialized successfully (512-dim).');
      return embeddingModel;
    } finally {
      isModelLoading = false;
    }
  })();

  return modelLoadPromise;
}

export function isModelReady(): boolean {
  return embeddingModel !== null;
}

/**
 * Preprocess drawing canvas to 28x28 grayscale inverted tensor with bounding-box centering
 */
export function toModelInput(canvas: HTMLCanvasElement): tf.Tensor4D {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;

  // 1. Find bounding box of drawn strokes
  let minX = w, minY = h, maxX = 0, maxY = 0;
  let hasStroke = false;

  if (ctx && w > 0 && h > 0) {
    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const alpha = data[i + 3];
        const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        
        // Count as ink if non-transparent (alpha > 20) or if drawn on opaque white canvas with contrast
        const isInk = alpha > 20 && (alpha < 240 || lum < 240);
        if (isInk) {
          hasStroke = true;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
  }

  const off = document.createElement('canvas');
  off.width = 28;
  off.height = 28;
  const octx = off.getContext('2d');
  if (!octx) throw new Error('Could not get 2d context for offscreen canvas');

  // Fill transparent offscreen canvas
  octx.clearRect(0, 0, 28, 28);

  // 2. Crop to bounding box and center into 20x20 area with 4px padding (QuickDraw standard)
  if (hasStroke && maxX >= minX && maxY >= minY) {
    const boxW = Math.max(1, maxX - minX + 1);
    const boxH = Math.max(1, maxY - minY + 1);
    const targetSize = 20; // 20x20 inside 28x28 leaves 4px border
    const scale = targetSize / Math.max(boxW, boxH);
    const drawW = Math.max(1, Math.round(boxW * scale));
    const drawH = Math.max(1, Math.round(boxH * scale));
    const drawX = Math.round((28 - drawW) / 2);
    const drawY = Math.round((28 - drawH) / 2);

    octx.drawImage(canvas, minX, minY, boxW, boxH, drawX, drawY, drawW, drawH);
  }

  const imgData = octx.getImageData(0, 0, 28, 28);
  const data = imgData.data;
  const gray = new Float32Array(28 * 28);

  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const alpha = data[i + 3];
    const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    
    // QuickDraw tensor: ink foreground = 1.0, background = 0.0
    if (alpha > 20) {
      // If drawn with light ink (like #f1e6ff) on transparent, alpha represents the stroke
      // If drawn with dark ink on opaque white, 1.0 - lum/255 represents the stroke
      const alphaWeight = alpha / 255;
      const contrastWeight = 1.0 - lum / 255;
      gray[p] = Math.max(alphaWeight, contrastWeight);
    } else {
      gray[p] = 0.0;
    }
  }

  return tf.tensor4d(gray, [1, 28, 28, 1]);
}

/**
 * Capture a square thumbnail PNG data URL
 */
export function makeThumb(canvas: HTMLCanvasElement, size = 96): string {
  const off = document.createElement('canvas');
  off.width = size;
  off.height = size;
  const octx = off.getContext('2d');
  if (!octx) return '';

  octx.fillStyle = '#ffffff';
  octx.fillRect(0, 0, size, size);
  octx.drawImage(canvas, 0, 0, size, size);
  return off.toDataURL('image/png');
}

/**
 * Extract 512-dim feature embedding vector from canvas
 */
export async function embedDrawing(canvas: HTMLCanvasElement): Promise<Float32Array> {
  const model = await getOrLoadEmbeddingModel();
  const input = toModelInput(canvas);
  const out = model.predict(input) as tf.Tensor;
  const data = out.dataSync();
  input.dispose();
  out.dispose();
  return new Float32Array(data);
}

/**
 * Cosine similarity between two vectors
 */
export function cosineSim(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-8);
}

export interface ClassificationResult {
  label: string | null;
  confidences: Record<string, number>;
  rawSimilarity: number;
}

/**
 * Nearest-Neighbor Cosine Similarity Classifier with Softmax Temperature Scaling
 */
export function classifyEmbedding(
  vec: ArrayLike<number>,
  store: Record<string, { vec: ArrayLike<number> }[]>,
  customK?: number
): ClassificationResult {
  const perClassScore: Record<string, number> = {};
  const labels = Object.keys(store).filter((l) => store[l] && store[l].length > 0);

  if (labels.length === 0) {
    return { label: null, confidences: {}, rawSimilarity: 0 };
  }

  const totalEx = labels.reduce((sum, l) => sum + store[l].length, 0);
  const avgPerClass = totalEx / Math.max(1, labels.length);
  const k = customK ?? Math.min(10, Math.max(1, Math.round(avgPerClass)));

  for (const label of labels) {
    const sims = store[label].map((ex) => cosineSim(vec, ex.vec)).sort((a, b) => b - a);
    const take = sims.slice(0, Math.max(1, Math.min(k, sims.length)));
    const avg = take.reduce((a, b) => a + b, 0) / take.length;
    perClassScore[label] = avg;
  }

  const temperature = 0.15;
  const scores = labels.map((l) => perClassScore[l] / temperature);
  const maxScore = Math.max(...scores);
  const exps = scores.map((s) => Math.exp(s - maxScore));
  const sumExp = exps.reduce((a, b) => a + b, 0);

  const confidences: Record<string, number> = {};
  labels.forEach((l, i) => {
    confidences[l] = exps[i] / sumExp;
  });

  const bestLabel = labels.reduce((a, b) => (perClassScore[a] >= perClassScore[b] ? a : b));
  return {
    label: bestLabel,
    confidences,
    rawSimilarity: perClassScore[bestLabel] || 0,
  };
}
