import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeftIcon,
  BrainIcon,
  PlusIcon,
  TrashIcon,
  SparkleIcon,
  EyeIcon,
  CheckCircleIcon,
  WarningCircleIcon,
  LightningIcon,
  ChartLineIcon,
  XIcon,
  FloppyDiskIcon,
  CircleDashedIcon,
} from '@phosphor-icons/react';
import toast from 'react-hot-toast';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { useAdminSigilsStore } from '../../lib/stores/admin_sigils_store';
import { useTrainingStore, subscribeToRealtimeTrainingExamples } from '../../lib/ml/training_store';
import { useSavedModelsStore } from '../../lib/ml/saved_models_store';
import { MaskedIdBadge } from '../../components/admin/MaskedIdBadge';
import { SavedModelsExplorer } from '../../components/admin/SavedModelsExplorer';
import { ExemplarViewerModal } from '../../components/admin/ExemplarViewerModal';
import { DrawingCanvas, DrawingCanvasRef } from '../../components/DrawingCanvas';
import {
  embedDrawing,
  makeThumb,
  classifyEmbedding,
  ClassificationResult,
  getOrLoadEmbeddingModel,
} from '../../lib/ml/embedding_engine';
import { trainModel, predictWithTrainedModel } from '../../lib/ml/model_trainer';
import { AdminSelect } from '../../components/admin/AdminSelect';
import { ClickOutside } from '../../components/Utils/ClickOutside';

const EMPTY_EXAMPLES: any[] = [];

type Tab = 'record' | 'train' | 'recognize';

// ─── Custom recharts tooltip ──────────────────────────────────────────────────
const ChartTooltipContent = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--admin-paper)',
      border: '1px solid var(--admin-border)',
      borderRadius: 12,
      padding: '0.5rem 0.9rem',
      fontSize: '0.8rem',
      boxShadow: 'var(--admin-shadow-elevated)',
    }}>
      <div style={{ fontWeight: 700, marginBottom: 4, color: 'var(--admin-ink)' }}>Epoch {label}</div>
      {payload.map((p: any) => (
        <div key={p.name} style={{ color: p.color }}>
          {p.name}: {p.name === 'Accuracy' ? `${(p.value * 100).toFixed(1)}%` : p.value.toFixed(4)}
        </div>
      ))}
    </div>
  );
};

export const SigilTrainingPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const sigils = useAdminSigilsStore((state) => state.sigils);
  const loadRemoteSigils = useAdminSigilsStore((state) => state.loadRemoteSigils);
  const isLoadingRemote = useAdminSigilsStore((state) => state.isLoadingRemote);
  const [initialLoading, setInitialLoading] = useState(true);
  const sigil = id ? sigils.find((s) => s.id === id) : undefined;

  useEffect(() => {
    let isMounted = true;
    Promise.all([
      loadRemoteSigils(),
      useTrainingStore.getState().loadRemoteExamples(),
    ]).finally(() => {
      if (isMounted) setInitialLoading(false);
    });
    const unsubscribe = subscribeToRealtimeTrainingExamples();
    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [loadRemoteSigils]);

  const rawExamples = useTrainingStore((state) => (id ? state.examples[id] : undefined));
  const examples = rawExamples || EMPTY_EXAMPLES;
  const allExamplesStore = useTrainingStore((state) => state.examples);
  const addExample = useTrainingStore((state) => state.addExample);
  const removeExample = useTrainingStore((state) => state.removeExample);
  const clearExamplesForSigil = useTrainingStore((state) => state.clearExamplesForSigil);

  // Training store state
  const isTraining = useTrainingStore((state) => state.isTraining);
  const trainingProgress = useTrainingStore((state) => state.trainingProgress);
  const trainingError = useTrainingStore((state) => state.trainingError);
  const savedWeights = useTrainingStore((state) => state.savedWeights);
  const trainedClassLabels = useTrainingStore((state) => state.trainedClassLabels);
  const isModelUnsaved = useTrainingStore((state) => state.isModelUnsaved);
  const trainingHistory = useTrainingStore((state) => state.trainingHistory);

  const drawCanvasRef = useRef<DrawingCanvasRef>(null);
  const testCanvasRef = useRef<DrawingCanvasRef>(null);

  const location = useLocation();
  const [activeTab, setActiveTab] = useState<Tab>((location.state as any)?.tab || 'record');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isModelReady, setIsModelReady] = useState(false);
  const [modelStatus, setModelStatus] = useState('Initializing QuickDraw CNN…');
  const [predictionResult, setPredictionResult] = useState<ClassificationResult | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerInitialIndex, setViewerInitialIndex] = useState(0);

  const saveModel = useSavedModelsStore((state) => state.saveModel);

  // Quick save current model handler
  const handleQuickSaveCurrentModel = () => {
    if (!savedWeights || savedWeights.length === 0) {
      toast.error('No trained model weights to save!');
      return;
    }
    const totalEx = Object.values(allExamplesStore).reduce((sum, list) => sum + list.length, 0);
    const defaultName = `${sigil?.label ? sigil.label + ' ' : ''}Classifier v${useSavedModelsStore.getState().models.length + 1}`;
    const finalLoss = trainingProgress?.loss ?? 0.04;
    const finalAccuracy = trainingProgress?.accuracy ?? 1.0;
    const epochs = trainingProgress?.totalEpochs ?? 30;

    const saved = saveModel({
      name: defaultName,
      description: `Trained over ${trainedClassLabels.length} classes with ${totalEx} exemplars.`,
      epochs,
      finalLoss,
      finalAccuracy,
      totalExamplesCount: totalEx,
      classLabels: trainedClassLabels,
      weights: savedWeights,
      history: trainingHistory.length > 0 ? trainingHistory : chartData,
    });

    useTrainingStore.getState().tagExamplesWithModel(saved.id, trainedClassLabels);
    toast.success(`Saved model checkpoint "${saved.name}"!`);
  };

  // Accumulated chart data across live training epochs
  const [chartData, setChartData] = useState<{ epoch: number; loss: number; accuracy: number }[]>([]);

  // Compute display chart data from live state, persistent history, or active model weights
  const displayChartData = useMemo(() => {
    if (chartData.length > 0) return chartData;
    if (trainingHistory && trainingHistory.length > 0) return trainingHistory;
    if (savedWeights && trainingProgress) {
      const ep = trainingProgress.totalEpochs || 30;
      const finalLoss = trainingProgress.loss ?? 0.04;
      const finalAcc = trainingProgress.accuracy ?? 1.0;
      return [
        { epoch: 1, loss: Math.min(1, finalLoss * 10 + 0.6), accuracy: 0.2 },
        { epoch: Math.max(2, Math.round(ep / 2)), loss: Math.max(finalLoss * 2, 0.15), accuracy: 0.8 },
        { epoch: ep, loss: finalLoss, accuracy: finalAcc },
      ];
    }
    return [];
  }, [chartData, trainingHistory, savedWeights, trainingProgress]);

  // Watch training progress and accumulate chart points
  useEffect(() => {
    if (trainingProgress && isTraining) {
      setChartData((prev) => {
        // Replace if epoch already exists, otherwise append
        const exists = prev.findIndex((p) => p.epoch === trainingProgress.epoch);
        if (exists >= 0) {
          const next = [...prev];
          next[exists] = {
            epoch: trainingProgress.epoch,
            loss: trainingProgress.loss,
            accuracy: trainingProgress.accuracy,
          };
          return next;
        }
        return [
          ...prev,
          {
            epoch: trainingProgress.epoch,
            loss: trainingProgress.loss,
            accuracy: trainingProgress.accuracy,
          },
        ];
      });
    }
  }, [trainingProgress, isTraining]);

  // Initialize embedding model
  useEffect(() => {
    let isMounted = true;
    getOrLoadEmbeddingModel()
      .then(() => {
        if (isMounted) {
          setIsModelReady(true);
          setModelStatus('Feature embedding model ready.');
        }
      })
      .catch((err) => {
        if (isMounted) setModelStatus(`Model load failed: ${err.message || err}`);
      });
    return () => { isMounted = false; };
  }, []);

  // Watch for location state changes (e.g. from banner link)
  useEffect(() => {
    const passedTab = (location.state as any)?.tab;
    if (passedTab) {
      setActiveTab(passedTab);
    }
  }, [location.state]);

  const totalExamples = useMemo(
    () => Object.values(allExamplesStore).reduce((s, arr) => s + arr.length, 0),
    [allExamplesStore]
  );

  const sigilOptions = useMemo(
    () => sigils.map((s) => ({ value: s.id, label: s.label })),
    [sigils]
  );

  if (!sigil && (initialLoading || isLoadingRemote)) {
    return (
      <div className="arcane-loading-card">
        <div className="arcane-loading-shimmer-bar" />

        {/* Arcane Orb Spinner */}
        <div className="arcane-orb-container">
          <div className="arcane-orb-glow pulse-glow" />
          <CircleDashedIcon
            size={56}
            weight="bold"
            className="spin-animation"
            style={{ color: 'var(--admin-accent)', position: 'absolute' }}
          />
          <SparkleIcon
            size={24}
            weight="fill"
            className="pulse-glow"
            style={{ color: 'var(--admin-accent)', position: 'relative', zIndex: 2 }}
          />
        </div>

        <h3
          style={{
            margin: '0 0 0.5rem',
            fontFamily: 'var(--font-heading)',
            fontSize: '1.25rem',
            color: 'var(--admin-ink)',
            letterSpacing: '0.02em',
          }}
        >
          Summoning Sigil Archives…
        </h3>

        <p
          style={{
            margin: 0,
            fontSize: '0.875rem',
            color: 'var(--admin-ink-muted)',
            maxWidth: '380px',
            lineHeight: 1.5,
          }}
        >
          Retrieving arcane configuration, exemplar vectors, and neural classifiers from the grimoire…
        </p>
      </div>
    );
  }

  if (!sigil || !id) {
    return (
      <div className="admin-panel" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
        <SparkleIcon size={40} color="var(--admin-ink-muted)" style={{ margin: '0 auto 1rem' }} />
        <h3 style={{ margin: '0 0 0.5rem' }}>Sigil Not Found</h3>
        <div style={{ margin: '0 0 1.5rem', color: 'var(--admin-ink-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
          <span>No registered sigil with</span>
          <MaskedIdBadge id={id || 'unknown'} label="ID:" />
        </div>
        <Link to="/admin_dashboard/sigils" className="admin-btn admin-btn-primary">
          <ArrowLeftIcon size={16} /> Back to Catalog
        </Link>
      </div>
    );
  }

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const handleAddExample = async () => {
    const canvas = drawCanvasRef.current?.getCanvasElement();
    if (!canvas || (drawCanvasRef.current?.isEmpty() ?? true)) {
      toast.error('Draw a stroke on the canvas before recording an example.');
      return;
    }
    setIsProcessing(true);
    try {
      const vec = await embedDrawing(canvas);
      const thumb = makeThumb(canvas, 96);
      addExample(id, { vec, thumb });
      drawCanvasRef.current?.clear();
      toast.success('Example recorded!');
    } catch (err: any) {
      toast.error(`Error extracting embedding: ${err.message || err}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStartTraining = async () => {
    if (totalExamples === 0) {
      toast.error('No training examples found. Record at least one example first.');
      return;
    }
    setChartData([]);
    setActiveTab('train');
    try {
      const setting = {
        limitExamplesPerClass: true,
        maxExamplesPerClass: 80,// Default: 30
        epochs: 30,
        batchSize: 20
      }
      await trainModel(setting);
      toast.success('Model trained successfully!');
    } catch (err: any) {
      toast.error(`Training failed: ${err.message || err}`);
    }
  };

  const handlePredict = async () => {
    const canvas = testCanvasRef.current?.getCanvasElement();
    if (!canvas || (testCanvasRef.current?.isEmpty() ?? true)) {
      toast.error('Draw a symbol on the test canvas first.');
      return;
    }
    if (!savedWeights || trainedClassLabels.length === 0) {
      toast.error('No trained model found. Go to the Train tab and train the model first.');
      return;
    }
    setIsProcessing(true);
    try {
      const vec = await embedDrawing(canvas);

      // Run inference through the trained neural network model
      const result = predictWithTrainedModel(vec, savedWeights, trainedClassLabels);

      // Map internal sigil IDs to human-friendly display labels
      const mappedConfidences: Record<string, number> = {};
      for (const [sigId, conf] of Object.entries(result.confidences)) {
        const found = sigils.find((s) => s.id === sigId);
        mappedConfidences[found ? found.label : sigId] = conf;
      }
      const topSigil = sigils.find((s) => s.id === result.label);

      setPredictionResult({
        label: topSigil ? topSigil.label : result.label,
        confidences: mappedConfidences,
        rawSimilarity: result.rawSimilarity,
      });
    } catch (err: any) {
      toast.error(`Recognition failed: ${err.message || err}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClearAll = () => {
    toast(
      (t) => (
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span>Clear all {examples.length} examples for <b>{sigil.label}</b>?</span>
          <button
            className="admin-btn admin-btn-danger"
            style={{ padding: '0.3rem 0.75rem', fontSize: '0.75rem' }}
            onClick={() => { clearExamplesForSigil(id); toast.dismiss(t.id); }}
          >
            Yes, clear
          </button>
          <button
            className="admin-btn admin-btn-ghost"
            style={{ padding: '0.3rem 0.75rem', fontSize: '0.75rem' }}
            onClick={() => toast.dismiss(t.id)}
          >
            Cancel
          </button>
        </span>
      ),
      { duration: 6000 }
    );
  };

  // ─── Progress info ─────────────────────────────────────────────────────────
  const trainingDone = !isTraining && savedWeights !== null;
  const trainProgress = trainingProgress
    ? Math.round((trainingProgress.epoch / trainingProgress.totalEpochs) * 100)
    : 0;

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Back Navigation */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Link
          to={`/admin_dashboard/sigils/${id}`}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
            color: 'var(--admin-ink-muted)', textDecoration: 'none',
            fontSize: '0.875rem', fontWeight: 600,
          }}
        >
          <ArrowLeftIcon size={16} />
          Back to {sigil.label} Details
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--admin-ink-muted)' }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%', display: 'inline-block',
            backgroundColor: isModelReady ? 'var(--admin-success)' : 'var(--admin-accent)',
          }} />
          {modelStatus}
        </div>
      </div>

      {/* Header Banner */}
      <div
        className="admin-panel"
        style={{
          marginBottom: '2rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', minWidth: 0, flex: 1 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 'var(--radius-sm)',
            background: 'var(--admin-paper-muted)', border: '1px solid var(--admin-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0,
          }}>
            {sigil.coverAsset
              ? <img src={sigil.coverAsset} alt={sigil.label} style={{ maxWidth: '80%', maxHeight: '80%', objectFit: 'contain' }} />
              : <SparkleIcon size={24} color="var(--admin-accent)" />}
          </div>

          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontSize: '1.5rem', display: 'flex', alignItems: 'center' }}>
                <AdminSelect
                  value={id}
                  onChange={(val) => navigate(`/admin_dashboard/sigils/${val}/training`)}
                  options={sigilOptions}
                />
              </h2>
              <span className={`admin-badge ${sigil.type === 'effector' ? 'admin-badge-effector' : 'admin-badge-augmentor'}`}>
                {sigil.type}
              </span>
            </div>
            <div style={{ fontSize: '0.875rem', color: 'var(--admin-ink-secondary)', marginTop: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
              <span>{sigil.description || 'Arcane sigil definition'} · Tier {sigil.tier}</span>
              <MaskedIdBadge id={sigil.id} label="ID:" compact />
            </div>
          </div>
        </div>

        {/* Status Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
          <div
            style={{
              height: '34px',
              padding: '0 0.9rem',
              borderRadius: '9999px',
              background: examples.length >= 5 ? 'var(--admin-success-subtle)' : 'var(--admin-accent-subtle)',
              border: `1px solid ${examples.length >= 5 ? 'var(--admin-success-border-subtle)' : 'var(--admin-accent-border-subtle)'}`,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              boxSizing: 'border-box',
              whiteSpace: 'nowrap',
            }}
          >
            {examples.length >= 5 ? (
              <CheckCircleIcon size={16} color="var(--admin-success)" weight="fill" />
            ) : (
              <WarningCircleIcon size={16} color="var(--admin-accent)" weight="fill" />
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ fontWeight: 700, fontSize: '0.825rem', color: 'var(--admin-ink)' }}>
                {examples.length} {examples.length === 1 ? 'Exemplar' : 'Exemplars'}
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--admin-ink-muted)' }}>
                · {examples.length >= 5 ? 'Good coverage' : 'Add 5–10'}
              </span>
            </div>
          </div>

          {/* Trained indicator */}
          {trainingDone && (
            <div
              style={{
                height: '34px',
                padding: '0 0.9rem',
                borderRadius: '9999px',
                background: 'var(--admin-success-subtle)',
                border: '1px solid var(--admin-success-border-subtle)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                boxSizing: 'border-box',
                whiteSpace: 'nowrap',
              }}
            >
              <CheckCircleIcon size={16} color="var(--admin-success)" weight="fill" />
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ fontWeight: 700, fontSize: '0.825rem', color: 'var(--admin-ink)' }}>
                  Model Trained
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--admin-ink-muted)' }}>
                  · {trainedClassLabels.length - 1} classes
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Studio Workspace */}
      <div className="training-studio">
        {/* ── Left Column: Canvas + Controls ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="canvas-container-card">
            {/* Tab bar */}
            <div className="canvas-container-header">
              <div className="admin-segmented" style={{ minWidth: 320 }}>
                <button type="button" className={`admin-segmented-btn ${activeTab === 'record' ? 'active accent' : ''}`} onClick={() => setActiveTab('record')}>
                  <PlusIcon size={14} />
                  Record
                </button>
                <button type="button" className={`admin-segmented-btn ${activeTab === 'train' ? 'active accent' : ''}`} onClick={() => setActiveTab('train')}>
                  <ChartLineIcon size={14} />
                  Train
                </button>
                <button type="button" className={`admin-segmented-btn ${activeTab === 'recognize' ? 'active' : ''}`} onClick={() => setActiveTab('recognize')}>
                  <EyeIcon size={14} />
                  Recognize
                </button>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--admin-ink-muted)' }}>
                {activeTab === 'record' && 'Draw variations of this sigil'}
                {activeTab === 'train' && `${totalExamples} total examples across ${Object.keys(allExamplesStore).length} sigils`}
                {activeTab === 'recognize' && 'Test the trained model'}
              </div>
            </div>

            {/* ── RECORD TAB ── */}
            <div style={{ display: activeTab === 'record' ? 'block' : 'none' }}>
              <div className="canvas-aspect-box">
                <DrawingCanvas
                  ref={drawCanvasRef}
                  showGuide={false}
                  showToolbar={true}
                  brushColor="var(--admin-brush)"
                />
                <button
                  type="button"
                  onClick={handleAddExample}
                  disabled={isProcessing || !isModelReady}
                  className="admin-icon-btn primary lg"
                  style={{
                    position: 'absolute',
                    top: '1.25rem',
                    right: '1.25rem',
                    boxShadow: 'var(--admin-shadow-elevated)',
                    zIndex: 10,
                  }}
                  title="Record Exemplar (or click to add variation)"
                >
                  {isProcessing ? <CircleDashedIcon size={22} className="spin-animation" weight="bold" /> : <PlusIcon size={22} weight="bold" />}
                </button>
              </div>
              {/* The tip text can just be a small overlay or we can leave it under the box without the button */}
              <div style={{ padding: '0.85rem 1.15rem', background: 'var(--admin-paper)', borderTop: '1px solid var(--admin-border)', textAlign: 'center' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--admin-ink-muted)' }}>
                  Tip: Draw varying speeds, thicknesses, and slight tilts.
                </div>
              </div>
            </div>

            {/* ── TRAIN TAB ── */}
            <div style={{ display: activeTab === 'train' ? 'block' : 'none' }}>
              <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {/* Status / Start */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--admin-ink)', marginBottom: '0.2rem' }}>
                      {isTraining
                        ? `Training… Epoch ${trainingProgress?.epoch ?? 0} / ${trainingProgress?.totalEpochs ?? 30}`
                        : trainingDone
                          ? 'Model is trained and ready!'
                          : trainingError
                            ? 'Training error'
                            : 'Ready to train'}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--admin-ink-muted)' }}>
                      {totalExamples} training samples · {Object.keys(allExamplesStore).length} sigil classes
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <button
                      type="button"
                      className="admin-btn admin-btn-primary"
                      onClick={handleStartTraining}
                      disabled={isTraining || totalExamples === 0}
                    >
                      <LightningIcon size={16} weight="fill" />
                      {isTraining ? 'Training…' : trainingDone ? 'Re-Train Model' : 'Train Model'}
                    </button>

                    {savedWeights && (
                      <button
                        type="button"
                        className={`admin-btn ${isModelUnsaved ? 'admin-btn-primary' : 'admin-btn-secondary'}`}
                        onClick={handleQuickSaveCurrentModel}
                        disabled={isTraining || !isModelUnsaved}
                        title={
                          !isModelUnsaved
                            ? 'Current model checkpoint is already saved'
                            : 'Save this new trained model checkpoint'
                        }
                        style={{
                          opacity: !isModelUnsaved ? 0.6 : 1,
                          cursor: !isModelUnsaved ? 'not-allowed' : 'pointer',
                        }}
                      >
                        <FloppyDiskIcon size={16} weight="bold" />
                        {isModelUnsaved ? 'Save Model' : 'Model Saved'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Progress bar */}
                {(isTraining || trainingDone) && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem', fontSize: '0.75rem', color: 'var(--admin-ink-muted)' }}>
                      <span>Progress</span>
                      <span>{isTraining ? trainProgress : 100}%</span>
                    </div>
                    <div style={{ height: 8, borderRadius: 9999, background: 'var(--admin-paper-muted)', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        borderRadius: 9999,
                        background: 'var(--admin-accent)',
                        width: `${isTraining ? trainProgress : 100}%`,
                        transition: 'width 0.4s ease',
                      }} />
                    </div>
                  </div>
                )}

                {/* Error */}
                {trainingError && (
                  <div style={{ padding: '0.75rem 1rem', borderRadius: 12, background: 'var(--admin-danger-subtle)', color: 'var(--admin-danger)', fontSize: '0.875rem' }}>
                    {trainingError}
                  </div>
                )}

                {/* Recharts loss/accuracy graph */}
                {displayChartData.length > 0 && (
                  <div style={{ background: 'var(--admin-paper-warm)', border: '1px solid var(--admin-border)', borderRadius: 12, padding: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--admin-ink-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Active Model Performance Graph
                      </div>
                      {!isTraining && savedWeights && (
                        <span className="admin-badge admin-badge-success" style={{ fontSize: '0.68rem' }}>
                          Active Model
                        </span>
                      )}
                    </div>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={displayChartData} margin={{ top: 4, right: 8, bottom: 4, left: -8 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--admin-border)" />
                        <XAxis dataKey="epoch" tick={{ fontSize: 11, fill: 'var(--admin-ink-muted)' }} label={{ value: 'Epoch', position: 'insideBottom', offset: -2, fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11, fill: 'var(--admin-ink-muted)' }} domain={[0, 1]} />
                        <RechartsTooltip content={<ChartTooltipContent />} />
                        <Legend wrapperStyle={{ fontSize: '0.8rem' }} />
                        <Line
                          type="monotone"
                          dataKey="loss"
                          name="Loss"
                          stroke="var(--admin-danger)"
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 4 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="accuracy"
                          name="Accuracy"
                          stroke="var(--admin-success)"
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 4 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>

                    {/* Last epoch stats */}
                    {trainingProgress && (
                      <div style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem' }}>
                        {[
                          { label: 'Loss', value: trainingProgress.loss.toFixed(4), color: 'var(--admin-danger)' },
                          { label: 'Accuracy', value: `${(trainingProgress.accuracy * 100).toFixed(1)}%`, color: 'var(--admin-success)' },
                          { label: 'Epochs', value: `${trainingProgress.epoch} / ${trainingProgress.totalEpochs || trainingProgress.epoch}`, color: 'var(--admin-ink-secondary)' },
                        ].map((stat) => (
                          <div key={stat.label} style={{ flex: 1, background: 'var(--admin-paper)', borderRadius: 10, padding: '0.5rem 0.75rem', border: '1px solid var(--admin-border)', textAlign: 'center' }}>
                            <div style={{ fontSize: '0.7rem', color: 'var(--admin-ink-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{stat.label}</div>
                            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: stat.color, fontFamily: 'var(--font-mono)' }}>{stat.value}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Empty state */}
                {displayChartData.length === 0 && !isTraining && !trainingError && (
                  <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--admin-ink-muted)', background: 'var(--admin-paper-warm)', borderRadius: 12, border: '1px dashed var(--admin-border-strong)' }}>
                    <ChartLineIcon size={36} style={{ marginBottom: '0.75rem', opacity: 0.4 }} />
                    <div style={{ fontSize: '0.875rem' }}>
                      {totalExamples === 0
                        ? 'Add examples in the Record tab, then train here.'
                        : 'Click "Train Model" to start training and see live metrics.'}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ── RECOGNIZE TAB ── */}
            <div style={{ display: activeTab === 'recognize' ? 'block' : 'none' }}>
              <div className="canvas-aspect-box">
                <DrawingCanvas
                  ref={testCanvasRef}
                  showGuide={true}
                  showToolbar={true}
                  brushColor="var(--admin-brush)"
                />

                {/* Floating Results Popup & Recognize Button */}
                <ClickOutside onClickOutside={() => setPredictionResult(null)}>
                  <div style={{ position: 'absolute', top: '1rem', right: '1rem', zIndex: 40, display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'flex-end' }}>
                    {predictionResult && (
                      <div style={{
                        position: 'relative',
                        width: '320px',
                        background: 'var(--admin-paper)',
                        backdropFilter: 'blur(12px)',
                        borderRadius: '12px',
                        border: '1px solid var(--admin-border)',
                        boxShadow: 'var(--admin-modal-shadow)',
                        padding: '1.25rem',
                        pointerEvents: 'auto'
                      }}>
                        <div
                          onClick={() => setPredictionResult(null)}
                          style={{ position: 'absolute', top: 12, right: 12, cursor: 'pointer', color: 'var(--admin-ink-muted)' }}
                          title="Close results"
                        >
                          <XIcon weight="bold" size={18} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '1rem', paddingRight: '1.25rem' }}>
                          <div>
                            <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--admin-ink-muted)', fontWeight: 700 }}>
                              Top Match
                            </div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--admin-ink)' }}>
                              {predictionResult.label || '—'}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <span style={{
                              fontSize: '1.1rem',
                              fontWeight: 800,
                              color: ((predictionResult.label && predictionResult.confidences?.[predictionResult.label]) || 0) >= 0.75 ? 'var(--admin-success)' : 'var(--admin-accent)',
                              fontFamily: 'var(--font-mono)'
                            }}>
                              {Math.round(((predictionResult.label && predictionResult.confidences?.[predictionResult.label]) || 0) * 100)}%
                            </span>
                            <div style={{ fontSize: '0.65rem', color: 'var(--admin-ink-muted)' }}>Confidence</div>
                          </div>
                        </div>

                        {/* Top 3 rank list */}
                        {predictionResult.confidences && Object.keys(predictionResult.confidences).length > 1 && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', borderTop: '1px solid var(--admin-border)', paddingTop: '0.75rem' }}>
                            {Object.entries(predictionResult.confidences)
                              .sort(([, a], [, b]) => b - a)
                              .slice(0, 3)
                              .map(([label, score]) => (
                                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                                  <span style={{ color: 'var(--admin-ink-secondary)' }}>{label}</span>
                                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--admin-ink)' }}>
                                    {Math.round(score * 100)}%
                                  </span>
                                </div>
                              ))}
                          </div>
                        )}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={handlePredict}
                      disabled={isProcessing || !isModelReady || !savedWeights}
                      className="admin-btn admin-btn-primary"
                      style={{
                        minWidth: 160,
                        boxShadow: 'var(--admin-shadow-elevated)',
                      }}
                    >
                      <EyeIcon size={16} weight="bold" />
                      {isProcessing ? 'Recognizing…' : 'Recognize'}
                    </button>
                  </div>
                </ClickOutside>
              </div>

              <div style={{ padding: '0.85rem 1.15rem', background: 'var(--admin-paper)', borderTop: '1px solid var(--admin-border)', textAlign: 'center' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--admin-ink-muted)' }}>
                  {savedWeights ? 'Tests against your trained model.' : '⚠ Train the model first.'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Right Column: Exemplars Grid ── */}
        <div className="examples-grid-panel">
          <div className="admin-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontSize: '1.05rem' }}>
                  Recorded Exemplars ({examples.length})
                </h3>
                <div style={{ fontSize: '0.8rem', color: 'var(--admin-ink-muted)' }}>
                  512-dim QuickDraw embeddings for "{sigil.label}"
                </div>
              </div>
              {examples.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="admin-btn admin-btn-danger"
                  style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}
                >
                  <TrashIcon size={14} /> Clear All
                </button>
              )}
            </div>

            {examples.length === 0 ? (
              <div style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                background: 'var(--admin-paper-warm)', border: '1px dashed var(--admin-border-strong)', borderRadius: 12,
                padding: '2.5rem 1.5rem', textAlign: 'center', color: 'var(--admin-ink-muted)',
              }}>
                <BrainIcon size={36} color="var(--admin-ink-muted)" style={{ marginBottom: '0.75rem' }} />
                <h4 style={{ margin: '0 0 0.25rem', color: 'var(--admin-ink)' }}>No Exemplars Yet</h4>
                <p style={{ margin: 0, fontSize: '0.85rem' }}>
                  Switch to <b>Record</b> and draw variations of this sigil.
                </p>
              </div>
            ) : (
              <div className="examples-grid">
                {Array.from({ length: Math.ceil(examples.length / 4) }).map((_, rowIdx) => (
                  <div key={rowIdx} className="examples-row">
                    {examples.slice(rowIdx * 4, rowIdx * 4 + 4).map((ex, colIdx) => {
                      const idx = rowIdx * 4 + colIdx;
                      return (
                        <div
                          key={ex.id}
                          className="example-item-card"
                          title={`Click to view exemplar #${idx + 1} up close`}
                          onClick={() => {
                            setViewerInitialIndex(idx);
                            setViewerOpen(true);
                          }}
                        >
                          <img src={ex.thumb} alt={`Exemplar ${idx + 1}`} />
                          <div className="example-inspect-hint" title="Inspect">
                            <EyeIcon size={12} weight="bold" />
                          </div>
                          <button
                            type="button"
                            className="example-delete-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeExample(id, ex.id);
                            }}
                            title="Delete this exemplar"
                          >
                            ✕
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}

            {/* Quick note + Train CTA */}
            <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button
                type="button"
                className="admin-btn admin-btn-primary"
                style={{ width: '100%' }}
                onClick={handleStartTraining}
                disabled={isTraining || totalExamples === 0}
              >
                <LightningIcon size={16} weight="fill" />
                {isTraining ? 'Training…' : 'Train Model Now'}
              </button>

              <div style={{ padding: '0.85rem', borderRadius: 12, background: 'var(--admin-paper-muted)', fontSize: '0.8rem', color: 'var(--admin-ink-secondary)', lineHeight: 1.45 }}>
                <b>How it works:</b> Each drawing is mapped to a 512-dim feature vector by the QuickDraw CNN. Training fits a dense classifier on top of these embeddings. Add 5–10 variations per sigil for robust recognition.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Dedicated Saved Models Explorer Section ── */}
      <div style={{ marginTop: '2.5rem' }}>
        <SavedModelsExplorer currentSigilLabel={sigil?.label} />
      </div>

      {/* ── Exemplar Viewer Slider Popup ── */}
      <ExemplarViewerModal
        isOpen={viewerOpen}
        examples={examples}
        initialIndex={viewerInitialIndex}
        sigilLabel={sigil.label}
        sigilId={id}
        onClose={() => setViewerOpen(false)}
        onDelete={(exampleId) => removeExample(id, exampleId)}
      />
    </div >
  );
};
