import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeftIcon,
  BrainIcon,
  EyeIcon,
  FloppyDiskIcon,
  SparkleIcon,
  XIcon,
  CaretLeftIcon,
  CaretRightIcon,
  CrosshairIcon,
  CheckCircleIcon,
  WarningCircleIcon,
  ArrowsOutCardinalIcon,
  InfoIcon,
  CircleDashedIcon,
} from '@phosphor-icons/react';
import toast from 'react-hot-toast';
import { DrawingCanvas, DrawingCanvasRef } from '../../components/DrawingCanvas';
import { SavedModelsExplorer } from '../../components/admin/SavedModelsExplorer';
import { ClickOutside } from '../../components/Utils/ClickOutside';
import { SaveGlyphModal } from '../../components/SaveGlyphModal';
import { GlyphDiagnosticsOverlay } from '../../components/DrawingPad/GlyphDiagnosticsOverlay';
import { useAdminSigilsStore } from '../../lib/stores/admin_sigils_store';
import { useAdminGlyphsStore } from '../../lib/stores/admin_glyphs_store';
import { useTrainingStore } from '../../lib/ml/training_store';
import { generateUUID } from '../../lib/uuid';
import { saveGlyphApi } from '../../lib/apis/api';
import {
  analyzeGlyphComposition,
  GlyphCompositionAnalysis,
  SegmentedCrop,
  DiagonalSearchZone,
} from '../../lib/ml/glyph_semantic_engine';
import { Element } from '../../types/glyph_types';
import {
  isSolid,
  checkSolidityFromAnalysis,
  buildCompositionFromAnalysis,
  buildAccuraciesFromAnalysis,
  defaultResolveSigilId,
  getCanvasSigilErrors,
} from '../../lib/glyph_helpers/glyph_solidity';
import { detectEnclosingCircle } from '../../lib/glyph_helpers/glyph_detection';

export const GlyphTestingPage: React.FC = () => {
  const drawCanvasRef = useRef<DrawingCanvasRef>(null);
  const sigils = useAdminSigilsStore((state) => state.sigils);
  const loadRemoteSigils = useAdminSigilsStore((state) => state.loadRemoteSigils);
  const firstSigilId = sigils.length > 0 ? sigils[0].id : 'eff-fire';
  const addGlyph = useAdminGlyphsStore((state) => state.addGlyph);
  const clearDraft = useAdminGlyphsStore((state) => state.clearDraft);
  const loadRemoteGlyphs = useAdminGlyphsStore((state) => state.loadRemoteGlyphs);

  useEffect(() => {
    loadRemoteSigils();
    loadRemoteGlyphs();
  }, [loadRemoteSigils, loadRemoteGlyphs]);

  const savedWeights = useTrainingStore((state) => state.savedWeights);
  const isModelReady = savedWeights && savedWeights.length > 0;

  const [isProcessing, setIsProcessing] = useState(false);
  const [hasStrokes, setHasStrokes] = useState(false);
  const [analysis, setAnalysis] = useState<GlyphCompositionAnalysis | null>(null);

  // Detail Modal state
  const [selectedCropIndex, setSelectedCropIndex] = useState<number | null>(null);

  // Save Glyph Modal state
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [saveGlyphName, setSaveGlyphName] = useState('');
  const [saveGlyphDesc, setSaveGlyphDesc] = useState('');
  const [saveGlyphElement, setSaveGlyphElement] = useState<Element | undefined>('fire');
  const [saveGlyphTier, setSaveGlyphTier] = useState<number>(1);
  const [saveGlyphPreview, setSaveGlyphPreview] = useState<string>('');

  // Dismissed errors state for low accuracy popups
  const [dismissedErrors, setDismissedErrors] = useState<Record<string, boolean>>({});
  // Session counter to trigger fresh auto-fade speech bubbles on recognition
  const [bubbleSessionId, setBubbleSessionId] = useState<number>(0);

  // Toggle for bounding box debug overlays
  const [showBounds, setShowBounds] = useState(false);

  const resolveSigilId = React.useCallback((label?: string | null) => {
    return defaultResolveSigilId(label, sigils);
  }, [sigils]);

  const liveSolidity = React.useMemo(() => {
    if (!analysis) return null;
    return checkSolidityFromAnalysis(analysis, sigils, resolveSigilId, {
      tier: saveGlyphTier,
      element: saveGlyphElement,
    });
  }, [analysis, sigils, saveGlyphElement, saveGlyphTier, resolveSigilId]);

  const circleDetectionResult = React.useMemo(() => {
    if (!analysis) return null;
    return detectEnclosingCircle(analysis, drawCanvasRef.current?.getCanvasElement());
  }, [analysis]);

  const isSlotFalseForSolidity = React.useCallback(
    (key: string): boolean => {
      if (!liveSolidity) return false;
      if (key === 'effector') return !liveSolidity.slots.effector;
      if (key in liveSolidity.slots.directions) {
        return !liveSolidity.slots.directions[key as keyof typeof liveSolidity.slots.directions];
      }
      if (key in liveSolidity.slots.formAugmentors) {
        return !liveSolidity.slots.formAugmentors[key as keyof typeof liveSolidity.slots.formAugmentors];
      }
      return false;
    },
    [liveSolidity]
  );

  const canvasSigilErrors = React.useMemo(() => {
    return getCanvasSigilErrors(analysis, liveSolidity);
  }, [analysis, liveSolidity]);

  const handleRecognizeGlyph = async () => {
    const canvas = drawCanvasRef.current?.getCanvasElement();
    if (!canvas || drawCanvasRef.current?.isEmpty()) {
      toast.error('Please draw one or more glyph symbols on the pad first.');
      return;
    }

    setIsProcessing(true);
    try {
      const result = await analyzeGlyphComposition(canvas);
      setAnalysis(result);
      setBubbleSessionId((prev) => prev + 1);
      setDismissedErrors({});
      if (result.rawCrops.length === 0) {
        toast('No distinct symbols detected on canvas.', { icon: '🔍' });
      } else {
        toast.success(`Identified ${result.rawCrops.length} symbol components across glyph slots!`);
      }
    } catch (err) {
      console.error('Glyph recognition error:', err);
      toast.error('Failed to process glyph symbols.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleOpenSaveModal = () => {
    const canvas = drawCanvasRef.current?.getCanvasElement();
    if (!canvas || drawCanvasRef.current?.isEmpty()) {
      toast.error('Please draw a glyph on the pad before saving.');
      return;
    }
    // Composite onto white background so exported coverAsset always has crisp black strokes on white
    const off = document.createElement('canvas');
    off.width = canvas.width;
    off.height = canvas.height;
    const ctx = off.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, off.width, off.height);
      ctx.drawImage(canvas, 0, 0);
    }
    const dataUrl = off.toDataURL('image/png');
    setSaveGlyphPreview(dataUrl);

    // Derive sensible default name
    const effectorLabel = analysis?.semanticCrops.effector.recognition.label;
    const defaultName = effectorLabel
      ? `${effectorLabel} Formation`
      : `Custom Arcane Glyph #${useAdminGlyphsStore.getState().glyphs.length + 1}`;
    setSaveGlyphName(defaultName);

    setSaveGlyphDesc(
      analysis
        ? `Composite glyph containing ${analysis.summary.totalComponents} components (${analysis.summary.effectorCount} central effector marks, ${analysis.summary.directionsCount} cardinal anchors, and ${analysis.summary.formsCount} form augmentors).`
        : 'Hand-drawn arcane composite glyph formation.'
    );

    // Auto-detect element
    const eff = analysis?.semanticCrops.effector.recognition.label?.toLowerCase() || '';
    if (eff.includes('fire')) setSaveGlyphElement('fire');
    else if (eff.includes('water')) setSaveGlyphElement('water');
    else if (eff.includes('earth')) setSaveGlyphElement('earth');
    else if (eff.includes('air')) setSaveGlyphElement('air');
    else setSaveGlyphElement(undefined);

    setSaveGlyphTier(1);
    setSaveModalOpen(true);
  };

  const handleSaveGlyphSubmit = async (data?: { name: string; description: string; element: any; tier: number; isPublic: boolean }) => {
    const finalName = (data?.name ?? saveGlyphName).trim();
    if (!finalName) {
      toast.error('Please enter a name for the glyph.');
      return;
    }
    const finalDesc = data?.description ?? saveGlyphDesc;
    const finalElement = (data?.element ?? saveGlyphElement) as Element | undefined;
    const finalTier = data?.tier ?? saveGlyphTier;

    const resolveSigilId = (label?: string | null) => {
      return defaultResolveSigilId(label, sigils);
    };

    const composition = analysis
      ? buildCompositionFromAnalysis(analysis, resolveSigilId, saveGlyphElement)
      : { directions: {}, formAugmentors: {} };

    const newGlyph = {
      id: generateUUID(),
      name: saveGlyphName.trim(),
      description: saveGlyphDesc.trim(),
      tier: saveGlyphTier,
      element: saveGlyphElement,
      coverAsset: saveGlyphPreview,
      composition,
      confidenceScore: analysis?.semanticCrops.effector.recognition.confidence || undefined,
      tags: [
        saveGlyphElement
          ? saveGlyphElement.toUpperCase() : 'UNKNOWN',
        `Tier ${saveGlyphTier}`, 'Custom Formation'
      ],
    };

    const accuracies = analysis ? buildAccuraciesFromAnalysis(analysis) : {};
    const solidity = isSolid(newGlyph, sigils, accuracies);
    if (!solidity.isSolid) {
      toast.error(solidity.reasons[0] || 'Glyph is not complete');
      setBubbleSessionId((prev) => prev + 1);
      setDismissedErrors({});
      return;
    }

    // 1. Add locally as draft
    addGlyph(newGlyph);

    // 2. Attempt Edge Function save
    try {
      await saveGlyphApi({
        name: newGlyph.name,
        description: newGlyph.description,
        element: newGlyph.element || 'fire',
        tier: newGlyph.tier,
        isPublic: Boolean(data?.isPublic),
        composition: newGlyph.composition,
      });
      clearDraft(newGlyph.id);
      await loadRemoteGlyphs();
      toast.success(`Saved "${newGlyph.name}" to database!`);
    } catch (edgeErr: any) {
      console.warn('save-glyph edge function skipped or failed:', edgeErr);
      toast(`Saved "${newGlyph.name}" locally as draft (Sign in to sync to cloud)`, { icon: '📝' });
    }

    setSaveModalOpen(false);
  };

  const openDetailModal = (index: number) => {
    if (!analysis || index < 0 || index >= analysis.rawCrops.length) return;
    setSelectedCropIndex(index);
  };

  const closeDetailModal = () => {
    setSelectedCropIndex(null);
  };

  const selectedCrop: SegmentedCrop | null =
    analysis && selectedCropIndex !== null ? analysis.rawCrops[selectedCropIndex] || null : null;

  return (
    <div className="glyph-testing-container">
      {/* ── Page Header & Navigation ── */}
      <div className="admin-page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
            <Link
              to="/admin_dashboard/glyphs"
              className="admin-btn admin-btn-secondary"
              style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem' }}
            >
              <ArrowLeftIcon size={14} /> Back to Glyphs
            </Link>
            <span style={{ color: 'var(--admin-ink-muted)', fontSize: '0.85rem' }}>/</span>
            <span style={{ color: 'var(--admin-accent)', fontSize: '0.85rem', fontWeight: 600 }}>
              Diagnostic Drawpad Studio
            </span>
          </div>

          <h2 className="admin-page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <CrosshairIcon size={28} weight="bold" color="var(--admin-accent)" />
            Glyph Testing & Semantic Recognition
          </h2>
          <p className="admin-page-subtitle">
            Draw composite arcane glyphs with cardinal direction anchors, diagonal form augmentors, and a central effector.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Button to go to Sigil Training Page */}
          <Link
            to={`/admin_dashboard/sigils/${firstSigilId}/training`}
            className="admin-btn admin-btn-secondary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', padding: '0.55rem 1rem' }}
            title="Open Sigil Exemplar Training Studio"
          >
            <BrainIcon size={18} weight="bold" color="var(--admin-accent)" />
            Train Sigil Models
          </Link>
        </div>
      </div>

      {/* ── Model Status Banner ── */}
      <div
        style={{
          background: isModelReady ? 'var(--admin-success-subtle)' : 'var(--admin-accent-subtle)',
          color: 'var(--admin-ink)',
          padding: '0.65rem 1rem',
          borderRadius: 'var(--radius-md)',
          marginBottom: '1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem',
          border: `1px solid ${isModelReady ? 'var(--admin-success)' : 'var(--admin-accent)'}`,
          fontSize: '0.85rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {isModelReady ? (
            <CheckCircleIcon size={18} weight="fill" color="var(--admin-success)" />
          ) : (
            <WarningCircleIcon size={18} weight="fill" color="var(--admin-accent)" />
          )}
          <span>
            {isModelReady
              ? 'Active Sigil ML Classifier loaded. Full two-stage geometry and ML recognition active.'
              : 'No active ML weights trained. Geometry & component segmentation are fully functional (ML labels marked as unclassified).'}
          </span>
        </div>

        <Link
          to={`/admin_dashboard/sigils/${firstSigilId}/training`}
          state={{ tab: 'train' }}
          style={{
            color: 'inherit',
            fontWeight: 600,
            fontSize: '0.8rem',
            textDecoration: 'underline',
            whiteSpace: 'nowrap',
          }}
        >
          {isModelReady ? 'Manage Weights' : 'Train Weights Now'}
        </Link>
      </div>

      {/* ── Main Two-Column Layout: Drawing Pad & Diagnostic Panel ── */}
      <div
        className="glyph-studio-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(340px, 1.25fr) minmax(360px, 1fr)',
          gap: '1.75rem',
          alignItems: 'start',
        }}
      >
        {/* ── Left Column: Drawing Pad ── */}
        <div className="admin-panel" style={{ display: 'flex', flexDirection: 'column', padding: '1.25rem', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <h3 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontSize: '1.15rem' }}>
                Glyph Drawing Canvas
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: 'var(--admin-ink-muted)' }}>
                Draw your full composite glyph inside the circular guides
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              {/* Recognize Button placed next to Save button */}
              <button
                type="button"
                onClick={handleRecognizeGlyph}
                disabled={isProcessing || !hasStrokes}
                className={`admin-btn admin-btn-primary ${isProcessing ? 'active' : ''}`}
                style={{
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.78rem',
                  height: 32,
                  display: 'inline-flex',
                  alignItems: 'center',
                  boxShadow: hasStrokes ? '0 2px 8px var(--admin-accent-glow)' : 'none',
                }}
                title={hasStrokes ? 'Recognize drawn glyph' : 'Draw symbols on pad to recognize'}
              >
                <EyeIcon size={15} weight="bold" />
                {isProcessing ? 'Recognizing…' : 'Recognize'}
              </button>

              <button
                type="button"
                onClick={handleOpenSaveModal}
                disabled={!hasStrokes}
                className="admin-btn admin-btn-secondary"
                style={{
                  padding: '0.35rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 34,
                  height: 32,
                  boxSizing: 'border-box',
                }}
                title="Save Glyph Formation to Catalog"
                aria-label="Save Glyph"
              >
                <FloppyDiskIcon size={18} />
              </button>

              <button
                type="button"
                onClick={() => {
                  drawCanvasRef.current?.clear();
                  setHasStrokes(false);
                  setAnalysis(null);
                  setDismissedErrors({});
                  setBubbleSessionId((prev) => prev + 1);
                }}
                disabled={!hasStrokes && !analysis}
                className="admin-btn admin-btn-secondary"
                style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', height: 32 }}
              >
                Clear Pad
              </button>

              <button
                type="button"
                onClick={() => setShowBounds((v) => !v)}
                className={`admin-btn ${showBounds ? 'admin-btn-primary' : 'admin-btn-secondary'}`}
                style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', height: 32 }}
                title={showBounds ? 'Hide bounding boxes' : 'Show bounding boxes'}
              >
                {showBounds ? 'Hide Bounds' : 'Show Bounds'}
              </button>
            </div>
          </div>

          <div
            className="canvas-aspect-box"
            style={{
              position: 'relative',
              width: '100%',
              aspectRatio: '1 / 1',
              borderRadius: 'var(--radius-md)',
              overflow: 'hidden',
              background: 'var(--admin-paper)',
              boxShadow: 'var(--admin-canvas-shadow)',
            }}
          >
            <DrawingCanvas
              ref={drawCanvasRef}
              showGuide={true}
              showToolbar={true}
              brushColor="var(--admin-brush)"
              defaultBrushSize={5}
              onStrokesChange={(strokes) => setHasStrokes(strokes.length > 0)}
            />

            {/* Modular Error Bounding Boxes & Directional Suggestion Speech Bubbles */}
            <GlyphDiagnosticsOverlay
              errors={canvasSigilErrors}
              canvasElement={drawCanvasRef.current?.getCanvasElement()}
              dismissedErrors={dismissedErrors}
              onDismissError={(key) => setDismissedErrors((prev) => ({ ...prev, [key]: true }))}
              sessionId={bubbleSessionId}
            />

            {/* Debug bounding boxes & Diagonal Detection Boundaries — toggled by Show Bounds */}
            {showBounds && analysis && (
              <>
                <svg
                  viewBox={`0 0 ${drawCanvasRef.current?.getCanvasElement()?.width || 500} ${drawCanvasRef.current?.getCanvasElement()?.height || 500}`}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    pointerEvents: 'none',
                    zIndex: 2,
                  }}
                >
                  {/* 1. Diagonal Detection Boundaries (Corner Search Zones: NW, NE, SW, SE) */}
                  {(analysis.diagonalZones || analysis.spatial?.diagonalZones || []).map((zone) => {
                    const badgeX =
                      zone.corner === 'NE' || zone.corner === 'SE'
                        ? Math.max(zone.bounds.minX + 8, zone.bounds.maxX - 52)
                        : zone.bounds.minX + 8;
                    const badgeY =
                      zone.corner === 'SW' || zone.corner === 'SE'
                        ? Math.max(zone.bounds.minY + 8, zone.bounds.maxY - 26)
                        : zone.bounds.minY + 8;

                    return (
                      <g key={`diag-zone-${zone.corner}`}>
                        {/* Shaded zone background */}
                        <rect
                          x={zone.bounds.minX}
                          y={zone.bounds.minY}
                          width={zone.bounds.width}
                          height={zone.bounds.height}
                          fill="rgba(199, 146, 234, 0.08)"
                          stroke="rgba(199, 146, 234, 0.65)"
                          strokeWidth="1.8"
                          strokeDasharray="6 4"
                        />
                        {/* Corner identification badge */}
                        <rect
                          x={badgeX}
                          y={badgeY}
                          width="44"
                          height="18"
                          rx="4"
                          fill="rgba(23, 18, 30, 0.92)"
                          stroke="rgba(199, 146, 234, 0.8)"
                          strokeWidth="1.2"
                        />
                        <text
                          x={badgeX + 22}
                          y={badgeY + 13}
                          fill="#e9d9ff"
                          fontSize="10"
                          fontFamily="system-ui, sans-serif"
                          fontWeight="700"
                          textAnchor="middle"
                        >
                          {zone.corner}
                        </text>
                      </g>
                    );
                  })}

                  {/* 2. Form Sigils detected inside diagonal quadrants (Purple) */}
                  {Object.entries(analysis.spatial?.forms || {}).map(([slotKey, crops]) =>
                    (crops as SegmentedCrop[]).map((c, idx) => (
                      <g key={`form-crop-${slotKey}-${idx}`}>
                        <rect
                          x={c.bbox.x}
                          y={c.bbox.y}
                          width={c.bbox.width}
                          height={c.bbox.height}
                          fill="rgba(199, 146, 234, 0.16)"
                          stroke="#c792ea"
                          strokeWidth="1.8"
                          rx="3"
                        />
                        <rect
                          x={c.bbox.x}
                          y={Math.max(0, c.bbox.y - 18)}
                          width={Math.max(56, Math.min(84, c.bbox.width))}
                          height="16"
                          rx="3"
                          fill="rgba(30, 20, 46, 0.92)"
                          stroke="#c792ea"
                          strokeWidth="1"
                        />
                        <text
                          x={c.bbox.x + 5}
                          y={Math.max(0, c.bbox.y - 18) + 11}
                          fill="#e9d9ff"
                          fontSize="9"
                          fontFamily="sans-serif"
                          fontWeight="600"
                        >
                          Form ({slotKey})
                        </text>
                      </g>
                    ))
                  )}

                  {/* 3. Cardinal Direction Anchor Bounding Boxes (Cyan / Sky Blue) */}
                  {Object.entries(analysis.spatial?.directions || {}).map(([dirKey, crop]) => {
                    const c = crop as SegmentedCrop | undefined;
                    if (!c) return null;
                    return (
                      <g key={`dir-crop-${dirKey}`}>
                        <rect
                          x={c.bbox.x}
                          y={c.bbox.y}
                          width={c.bbox.width}
                          height={c.bbox.height}
                          fill="rgba(56, 189, 248, 0.12)"
                          stroke="#38bdf8"
                          strokeWidth="1.8"
                          rx="3"
                        />
                        <rect
                          x={c.bbox.x}
                          y={Math.max(0, c.bbox.y - 18)}
                          width={Math.max(48, Math.min(74, c.bbox.width))}
                          height="16"
                          rx="3"
                          fill="rgba(15, 23, 42, 0.92)"
                          stroke="#38bdf8"
                          strokeWidth="1"
                        />
                        <text
                          x={c.bbox.x + 5}
                          y={Math.max(0, c.bbox.y - 18) + 11}
                          fill="#7dd3fc"
                          fontSize="9"
                          fontFamily="sans-serif"
                          fontWeight="600"
                        >
                          Dir ({dirKey})
                        </text>
                      </g>
                    );
                  })}

                  {/* 4a. Effector Search Box Bounded by Cardinal Anchors */}
                  {analysis.spatial?.region && (
                    <g key="effector-search-region">
                      <rect
                        x={analysis.spatial.region.left}
                        y={analysis.spatial.region.top}
                        width={Math.max(0, analysis.spatial.region.right - analysis.spatial.region.left)}
                        height={Math.max(0, analysis.spatial.region.bottom - analysis.spatial.region.top)}
                        fill="rgba(245, 158, 11, 0.04)"
                        stroke="rgba(245, 158, 11, 0.55)"
                        strokeWidth="1.4"
                        strokeDasharray="5 4"
                        rx="4"
                      />
                    </g>
                  )}

                  {/* 4b. Effector Detected Sigil Bounding Box (Amber / Gold) */}
                  {analysis.effectorBBox && (
                    <g key="effector-bbox-group">
                      <rect
                        x={analysis.effectorBBox.x}
                        y={analysis.effectorBBox.y}
                        width={analysis.effectorBBox.width}
                        height={analysis.effectorBBox.height}
                        fill="rgba(245, 158, 11, 0.12)"
                        stroke="#f59e0b"
                        strokeWidth="2"
                        rx="3"
                      />
                      <rect
                        x={analysis.effectorBBox.x}
                        y={Math.max(0, analysis.effectorBBox.y - 18)}
                        width="54"
                        height="16"
                        rx="3"
                        fill="rgba(40, 25, 10, 0.92)"
                        stroke="#f59e0b"
                        strokeWidth="1"
                      />
                      <text
                        x={analysis.effectorBBox.x + 5}
                        y={Math.max(0, analysis.effectorBBox.y - 18) + 11}
                        fill="#fde68a"
                        fontSize="9"
                        fontFamily="sans-serif"
                        fontWeight="600"
                      >
                        Effector
                      </text>
                    </g>
                  )}

                  {/* 5. All raw component bounding boxes (Green dashed) */}
                  {analysis.rawCrops.map((crop, idx) => (
                    <rect
                      key={`raw-${idx}`}
                      x={crop.bbox.x}
                      y={crop.bbox.y}
                      width={crop.bbox.width}
                      height={crop.bbox.height}
                      fill="none"
                      stroke="#22c55e"
                      strokeWidth="1"
                      strokeDasharray="3 3"
                      opacity={0.5}
                    />
                  ))}
                  {/* 6. Enclosing Circle Bounding Box & Circular Perimeter Guide */}
                  {circleDetectionResult?.hasCircle && circleDetectionResult.circleCrop && (
                    <g key="enclosing-circle-bounds">
                      <rect
                        x={circleDetectionResult.circleCrop.bbox.x}
                        y={circleDetectionResult.circleCrop.bbox.y}
                        width={circleDetectionResult.circleCrop.bbox.width}
                        height={circleDetectionResult.circleCrop.bbox.height}
                        fill={circleDetectionResult.isClosed ? 'rgba(16, 185, 129, 0.08)' : 'rgba(245, 158, 11, 0.08)'}
                        stroke={circleDetectionResult.isClosed ? '#10b981' : '#f59e0b'}
                        strokeWidth="2"
                        strokeDasharray={circleDetectionResult.isClosed ? undefined : '6 4'}
                        rx="4"
                      />
                      <circle
                        cx={circleDetectionResult.center.x}
                        cy={circleDetectionResult.center.y}
                        r={circleDetectionResult.radius}
                        fill="none"
                        stroke={circleDetectionResult.isClosed ? '#10b981' : '#f59e0b'}
                        strokeWidth="1.5"
                        strokeDasharray="4 3"
                        opacity={0.7}
                      />
                      <rect
                        x={circleDetectionResult.circleCrop.bbox.x}
                        y={Math.max(0, circleDetectionResult.circleCrop.bbox.y - 18)}
                        width={circleDetectionResult.isClosed ? 90 : 80}
                        height="16"
                        rx="3"
                        fill="rgba(15, 23, 42, 0.92)"
                        stroke={circleDetectionResult.isClosed ? '#10b981' : '#f59e0b'}
                        strokeWidth="1"
                      />
                      <text
                        x={circleDetectionResult.circleCrop.bbox.x + 5}
                        y={Math.max(0, circleDetectionResult.circleCrop.bbox.y - 18) + 11}
                        fill={circleDetectionResult.isClosed ? '#6ee7b7' : '#fde68a'}
                        fontSize="9"
                        fontFamily="sans-serif"
                        fontWeight="600"
                      >
                        {circleDetectionResult.isClosed ? 'Circle (Closed)' : 'Circle (Open)'}
                      </text>
                    </g>
                  )}
                </svg>

                {/* Legend overlay for boundary boxes */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: 8,
                    left: 8,
                    right: 8,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.65rem',
                    flexWrap: 'wrap',
                    padding: '5px 10px',
                    background: 'rgba(15, 12, 22, 0.92)',
                    backdropFilter: 'blur(6px)',
                    borderRadius: '8px',
                    border: '1px solid rgba(180, 140, 230, 0.25)',
                    fontSize: '0.68rem',
                    color: '#e2d4f8',
                    pointerEvents: 'none',
                    zIndex: 4,
                  }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 10, height: 10, border: '1.5px dashed #c792ea', background: 'rgba(199, 146, 234, 0.2)', borderRadius: 2 }} />
                    Diagonal Zones
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 10, height: 10, border: '1.5px solid #c792ea', background: 'rgba(199, 146, 234, 0.4)', borderRadius: 2 }} />
                    Form Sigil
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 10, height: 10, border: '1.5px solid #38bdf8', background: 'rgba(56, 189, 248, 0.3)', borderRadius: 2 }} />
                    Cardinal Anchor
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 10, height: 10, border: '1.5px solid #f59e0b', background: 'rgba(245, 158, 11, 0.3)', borderRadius: 2 }} />
                    Effector
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 10, height: 10, border: '1px dashed #22c55e', borderRadius: 2 }} />
                    Raw Mark
                  </span>
                  {circleDetectionResult?.hasCircle && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <span
                        style={{
                          width: 10,
                          height: 10,
                          border: `1.5px solid ${circleDetectionResult.isClosed ? '#10b981' : '#f59e0b'}`,
                          background: circleDetectionResult.isClosed ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)',
                          borderRadius: 2,
                        }}
                      />
                      Circle ({circleDetectionResult.isClosed ? 'Closed' : 'Open'})
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── Right Column: Diagnostic Panel ── */}
        <div className="admin-panel" style={{ display: 'flex', flexDirection: 'column', padding: '1.25rem', gap: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontSize: '1.15rem' }}>
                Semantic Diagnostic Panel
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: 'var(--admin-ink-muted)' }}>
                Spatial Slot Decomposition & ML Sigil Classification
              </p>
            </div>

            {analysis && (
              <span className="admin-badge admin-badge-success" style={{ fontSize: '0.75rem' }}>
                {analysis.summary.totalComponents} components analyzed
              </span>
            )}
          </div>

          {!analysis ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 380,
                background: 'var(--admin-paper-warm)',
                border: '1px dashed var(--admin-border-strong)',
                borderRadius: 'var(--radius-md)',
                padding: '2rem',
                textAlign: 'center',
                color: 'var(--admin-ink-muted)',
              }}
            >
              <ArrowsOutCardinalIcon size={44} style={{ marginBottom: '0.75rem', opacity: 0.5 }} />
              <h4 style={{ margin: '0 0 0.25rem', color: 'var(--admin-ink)' }}>No Diagnostic Data</h4>
              <p style={{ margin: 0, fontSize: '0.85rem', maxWidth: 320 }}>
                Draw a composite glyph and click <b>Recognize Glyph</b> to generate the live spatial diagram and component breakdown.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Summary Chips */}
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span
                  style={{
                    padding: '0.35rem 0.75rem',
                    borderRadius: 9999,
                    background: 'var(--admin-accent-badge)',
                    color: 'var(--admin-ink)',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                  }}
                >
                  Effector Marks: {analysis.summary.effectorCount}
                </span>
                <span
                  style={{
                    padding: '0.35rem 0.75rem',
                    borderRadius: 9999,
                    background: 'var(--admin-paper-muted)',
                    color: 'var(--admin-ink-secondary)',
                    fontSize: '0.78rem',
                  }}
                >
                  Directions: {analysis.summary.directionsCount} / 4
                </span>
                <span
                  style={{
                    padding: '0.35rem 0.75rem',
                    borderRadius: 9999,
                    background: 'var(--admin-paper-muted)',
                    color: 'var(--admin-ink-secondary)',
                    fontSize: '0.78rem',
                  }}
                >
                  Form Augmentors: {analysis.summary.formsCount}
                </span>

                {/* Is Closed Status Pill */}
                {circleDetectionResult && (
                  <span
                    style={{
                      padding: '0.35rem 0.75rem',
                      borderRadius: 9999,
                      background: !circleDetectionResult.hasCircle
                        ? 'var(--admin-paper-muted)'
                        : circleDetectionResult.isClosed
                        ? '#ecfdf5'
                        : '#fffbeb',
                      color: !circleDetectionResult.hasCircle
                        ? 'var(--admin-ink-muted)'
                        : circleDetectionResult.isClosed
                        ? '#059669'
                        : '#d97706',
                      border: `1px solid ${
                        !circleDetectionResult.hasCircle
                          ? 'var(--admin-border)'
                          : circleDetectionResult.isClosed
                          ? '#a7f3d0'
                          : '#fde68a'
                      }`,
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                    }}
                    title={
                      !circleDetectionResult.hasCircle
                        ? 'No outer boundary circle detected'
                        : circleDetectionResult.isClosed
                        ? 'Outer boundary circle forms a continuous closed loop'
                        : 'Outer boundary circle has an opening / gap (open loop)'
                    }
                  >
                    {!circleDetectionResult.hasCircle ? (
                      <>
                        <CircleDashedIcon size={14} />
                        Is Closed: None
                      </>
                    ) : circleDetectionResult.isClosed ? (
                      <>
                        <CheckCircleIcon size={14} weight="bold" />
                        Is Closed: Closed
                      </>
                    ) : (
                      <>
                        <WarningCircleIcon size={14} weight="bold" />
                        Is Closed: Open
                      </>
                    )}
                  </span>
                )}

                {liveSolidity && (
                  <span
                    style={{
                      padding: '0.35rem 0.75rem',
                      borderRadius: 9999,
                      background: liveSolidity.isSolid ? '#ecfdf5' : '#fff1f2',
                      color: liveSolidity.isSolid ? '#059669' : '#e11d48',
                      border: `1px solid ${liveSolidity.isSolid ? '#a7f3d0' : '#fecdd3'}`,
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                    }}
                    title={liveSolidity.reasons.join('\n') || 'All slots pass solidity criteria'}
                  >
                    {liveSolidity.isSolid ? (
                      <>
                        <CheckCircleIcon size={14} weight="bold" /> Solid Formation
                      </>
                    ) : (
                      <>
                        <WarningCircleIcon size={14} weight="bold" /> {liveSolidity.reasons[0] || 'Incomplete Formation'}
                      </>
                    )}
                  </span>
                )}
              </div>

              {/* ── Live Radial / Compass Glyph Diagram (White Aesthetic) ── */}
              <div
                className="radial-glyph-diagram"
                style={{
                  position: 'relative',
                  width: '100%',
                  aspectRatio: '1 / 1',
                  maxHeight: 440,
                  borderRadius: 'var(--radius-lg)',
                  background: 'var(--admin-diagram-bg)',
                  border: '1.5px solid var(--admin-diagram-border)',
                  boxShadow: 'var(--admin-diagram-node-shadow)',
                  overflow: 'hidden',
                  margin: '0 auto',
                }}
              >
                {/* SVG Guide lines */}
                <svg
                  viewBox="0 0 500 500"
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', opacity: 0.7 }}
                >
                  <circle cx="250" cy="250" r="190" fill="none" stroke="var(--admin-diagram-guide)" strokeWidth="1.5" strokeDasharray="8 6" />
                  <line x1="250" y1="40" x2="250" y2="460" stroke="var(--admin-diagram-guide)" strokeWidth="1.5" strokeDasharray="6 6" />
                  <line x1="40" y1="250" x2="460" y2="250" stroke="var(--admin-diagram-guide)" strokeWidth="1.5" strokeDasharray="6 6" />
                </svg>

                {/* Central Effector Node */}
                {(() => {
                  const isEffectorFalse = isSlotFalseForSolidity('effector');
                  return (
                    <div
                      style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: 114,
                        minHeight: 110,
                        background: 'var(--admin-diagram-node-bg)',
                        border: liveSolidity
                          ? isEffectorFalse
                            ? '2px solid #ef4444'
                            : '2px solid #10b981'
                          : '2px solid var(--admin-accent)',
                        borderRadius: 14,
                        padding: 6,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 3,
                        boxShadow: '0 4px 16px var(--admin-accent-glow), var(--admin-diagram-node-shadow)',
                        zIndex: 10,
                        textAlign: 'center',
                        transition: 'all 0.25s ease',
                      }}
                    >
                      {liveSolidity && (
                        <div
                          style={{
                            position: 'absolute',
                            top: 6,
                            right: 6,
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            background: isEffectorFalse ? '#ef4444' : '#10b981',
                            boxShadow: isEffectorFalse ? '0 0 4px #ef4444' : '0 0 4px #10b981',
                          }}
                          title={isEffectorFalse ? 'Effector missing or invalid' : 'Effector solidity passed'}
                        />
                      )}
                      {analysis.effectorCrop ? (
                        <img
                          src={analysis.semanticCrops.effector.dataUrl || ''}
                          alt="Effector Crop"
                          style={{
                            width: 58,
                            height: 52,
                            objectFit: 'contain',
                            background: 'var(--admin-crop-preview-bg)',
                            borderRadius: 6,
                            border: '1px solid var(--admin-border)',
                            transition: 'all 0.25s ease',
                          }}
                        />
                      ) : (
                        <div style={{ fontSize: '0.65rem', color: isEffectorFalse ? '#f43f5e' : 'var(--admin-ink-muted)', fontWeight: isEffectorFalse ? 600 : 400 }}>No marks in center</div>
                      )}
                      <span
                        style={{
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          color: 'var(--admin-ink)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                        }}
                      >
                        Effector
                      </span>
                      <span style={{ fontSize: '0.62rem', color: isEffectorFalse ? '#e11d48' : 'var(--admin-accent)', fontWeight: 600, lineHeight: 1.1 }}>
                        {analysis.semanticCrops.effector.recognition.label
                          ? `${analysis.semanticCrops.effector.recognition.label} · ${Math.round((analysis.semanticCrops.effector.recognition.confidence || 0) * 100)}%`
                          : isModelReady
                            ? 'Unrecognized'
                            : 'Model not loaded'}
                      </span>
                    </div>
                  );
                })()}

                {/* 4 Cardinal Direction Nodes */}
                {[
                  { key: 'top', label: '↑ Top', top: '12%', left: '50%' },
                  { key: 'right', label: '→ Right', top: '50%', left: '87%' },
                  { key: 'bottom', label: '↓ Bottom', top: '88%', left: '50%' },
                  { key: 'left', label: '← Left', top: '50%', left: '13%' },
                ].map((item) => {
                  const data = analysis.semanticCrops[item.key];
                  const isDirFalse = isSlotFalseForSolidity(item.key);
                  const isSlotSolid = liveSolidity
                    ? liveSolidity.slots.directions[item.key as keyof typeof liveSolidity.slots.directions]
                    : null;
                  return (
                    <div
                      key={item.key}
                      style={{
                        position: 'absolute',
                        top: item.top,
                        left: item.left,
                        transform: 'translate(-50%, -50%)',
                        width: 78,
                        minHeight: 72,
                        background: 'var(--admin-diagram-node-bg)',
                        border: isDirFalse
                          ? '1.5px solid #ef4444'
                          : isSlotSolid
                            ? '1.5px solid #10b981'
                            : '1.5px solid var(--admin-diagram-node-border)',
                        borderRadius: 10,
                        padding: 4,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 2,
                        boxShadow: 'var(--admin-diagram-node-shadow)',
                        zIndex: 5,
                        textAlign: 'center',
                        transition: 'all 0.25s ease',
                      }}
                    >
                      {liveSolidity && (
                        <div
                          style={{
                            position: 'absolute',
                            top: 4,
                            right: 4,
                            width: 7,
                            height: 7,
                            borderRadius: '50%',
                            background: isDirFalse ? '#ef4444' : '#10b981',
                            boxShadow: isDirFalse ? '0 0 4px #ef4444' : '0 0 4px #10b981',
                          }}
                          title={isDirFalse ? 'Solidity slot missing or invalid' : 'Solidity passed'}
                        />
                      )}
                      {data?.dataUrl ? (
                        <img
                          src={data.dataUrl}
                          alt={item.label}
                          style={{
                            width: 36,
                            height: 34,
                            objectFit: 'contain',
                            background: 'var(--admin-crop-preview-bg)',
                            borderRadius: 4,
                            border: '1px solid var(--admin-border)',
                            transition: 'all 0.25s ease',
                          }}
                        />
                      ) : (
                        <div style={{ fontSize: '0.58rem', color: isDirFalse ? '#f43f5e' : 'var(--admin-ink-muted)', fontWeight: isDirFalse ? 600 : 400 }}>Empty</div>
                      )}
                      <span style={{ fontSize: '0.62rem', fontWeight: 600, color: 'var(--admin-ink)' }}>{item.label}</span>
                      <span style={{ fontSize: '0.55rem', color: isDirFalse ? '#e11d48' : 'var(--admin-ink-muted)', lineHeight: 1 }}>
                        {data?.recognition?.label || (data?.dataUrl ? 'Anchor' : 'None')}
                      </span>
                    </div>
                  );
                })}

                {/* 4 Diagonal Form Augmentor Nodes */}
                {[
                  { key: 'topLeft', label: '↖ Form TL', top: '24%', left: '24%' },
                  { key: 'topRight', label: '↗ Form TR', top: '24%', left: '76%' },
                  { key: 'bottomLeft', label: '↙ Form BL', top: '76%', left: '24%' },
                  { key: 'bottomRight', label: '↘ Form BR', top: '76%', left: '76%' },
                ].map((item) => {
                  const data = analysis.semanticCrops[item.key];
                  const isFormFalse = isSlotFalseForSolidity(item.key);
                  const isSlotSolid = liveSolidity
                    ? liveSolidity.slots.formAugmentors[item.key as keyof typeof liveSolidity.slots.formAugmentors]
                    : null;
                  return (
                    <div
                      key={item.key}
                      style={{
                        position: 'absolute',
                        top: item.top,
                        left: item.left,
                        transform: 'translate(-50%, -50%)',
                        width: 74,
                        minHeight: 68,
                        background: 'var(--admin-diagram-node-bg)',
                        border: isFormFalse
                          ? '1.5px dashed #ef4444'
                          : isSlotSolid
                            ? '1.5px solid #10b981'
                            : '1.5px dashed var(--admin-diagram-node-border)',
                        borderRadius: 10,
                        padding: 4,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 2,
                        boxShadow: 'var(--admin-diagram-node-shadow)',
                        zIndex: 5,
                        textAlign: 'center',
                        transition: 'all 0.25s ease',
                      }}
                    >
                      {liveSolidity && (
                        <div
                          style={{
                            position: 'absolute',
                            top: 4,
                            right: 4,
                            width: 7,
                            height: 7,
                            borderRadius: '50%',
                            background: isFormFalse ? '#ef4444' : '#10b981',
                            boxShadow: isFormFalse ? '0 0 4px #ef4444' : '0 0 4px #10b981',
                          }}
                          title={isFormFalse ? 'Solidity slot missing or mismatched' : 'Solidity passed'}
                        />
                      )}
                      {data?.dataUrl ? (
                        <img
                          src={data.dataUrl}
                          alt={item.label}
                          style={{
                            width: 34,
                            height: 32,
                            objectFit: 'contain',
                            background: 'var(--admin-crop-preview-bg)',
                            borderRadius: 4,
                            border: '1px solid var(--admin-border)',
                            transition: 'all 0.25s ease',
                          }}
                        />
                      ) : (
                        <div style={{ fontSize: '0.55rem', color: isFormFalse ? '#f43f5e' : 'var(--admin-ink-muted)', fontWeight: isFormFalse ? 600 : 400 }}>Empty</div>
                      )}
                      <span style={{ fontSize: '0.58rem', fontWeight: 600, color: 'var(--admin-ink-secondary)' }}>{item.label}</span>
                      <span style={{ fontSize: '0.52rem', color: isFormFalse ? '#e11d48' : 'var(--admin-ink-muted)', lineHeight: 1 }}>
                        {data?.recognition?.label || (data?.dataUrl ? 'Augmentor' : 'None')}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* ── Semantic Region Breakdown List ── */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                <h4 style={{ margin: '0.5rem 0 0', fontSize: '0.9rem', color: 'var(--admin-ink)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Semantic Region Breakdown
                </h4>
                {Object.values(analysis.semanticCrops).map((crop) => {
                  const isCropFalse = isSlotFalseForSolidity(crop.key);
                  return (
                    <div
                      key={crop.key}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '44px 1fr auto',
                        alignItems: 'center',
                        gap: '0.75rem',
                        padding: '0.65rem 0.85rem',
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--admin-paper)',
                        border: isCropFalse ? '1.5px solid #fca5a5' : '1px solid var(--admin-border)',
                        transition: 'all 0.25s ease',
                      }}
                    >
                      {crop.dataUrl ? (
                        <img
                          src={crop.dataUrl}
                          alt={crop.title}
                          style={{
                            width: 44,
                            height: 44,
                            objectFit: 'contain',
                            background: 'var(--admin-crop-preview-bg)',
                            borderRadius: 6,
                            border: '1px solid var(--admin-border)',
                            transition: 'all 0.25s ease',
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: 44,
                            height: 44,
                            background: isCropFalse ? '#fff1f2' : 'var(--admin-paper-muted)',
                            borderRadius: 6,
                            border: isCropFalse ? '1px dashed #ef4444' : undefined,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.7rem',
                            color: isCropFalse ? '#e11d48' : 'var(--admin-ink-muted)',
                            fontWeight: isCropFalse ? 700 : 400,
                          }}
                        >
                          —
                        </div>
                      )}

                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.15rem' }}>
                          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--admin-ink)' }}>
                            {crop.title}
                          </span>
                          {liveSolidity && (
                            <span
                              style={{
                                fontSize: '0.62rem',
                                fontWeight: 700,
                                padding: '0.12rem 0.45rem',
                                borderRadius: 999,
                                background: isCropFalse ? '#ffe4e6' : '#ecfdf5',
                                color: isCropFalse ? '#e11d48' : '#059669',
                                border: `1px solid ${isCropFalse ? '#fecdd3' : '#a7f3d0'}`,
                              }}
                            >
                              {isCropFalse ? 'Solidity Failed' : 'Solid'}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: isCropFalse ? '#e11d48' : crop.recognition.label ? 'var(--admin-accent)' : 'var(--admin-ink-muted)', fontWeight: crop.recognition.label || isCropFalse ? 600 : 400 }}>
                          {crop.recognition.label
                            ? `Identified: ${crop.recognition.label} (${Math.round((crop.recognition.confidence || 0) * 100)}% match)`
                            : crop.dataUrl
                              ? isModelReady
                                ? 'Unclassified'
                                : 'Model weights not trained'
                              : 'No stroke marks'}
                        </div>
                      </div>

                      <span style={{ fontSize: '0.75rem', color: 'var(--admin-ink-secondary)', fontFamily: 'var(--font-mono)' }}>
                        {crop.componentCount > 0 ? `${crop.componentCount} mark${crop.componentCount === 1 ? '' : 's'}` : 'Empty'}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* ── Raw Components Gallery ── */}
              <div style={{ marginTop: '0.5rem', borderTop: '1px solid var(--admin-border)', paddingTop: '1rem' }}>
                <h4 style={{ margin: '0 0 0.65rem', fontSize: '0.85rem', color: 'var(--admin-ink-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Raw Segmented Components ({analysis.rawCrops.length})
                </h4>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(70px, 1fr))',
                    gap: '0.65rem',
                  }}
                >
                  {analysis.rawCrops.map((crop, idx) => (
                    <button
                      key={crop.index}
                      type="button"
                      onClick={() => openDetailModal(idx)}
                      style={{
                        padding: '0.35rem',
                        background: 'var(--admin-paper)',
                        border: '1px solid var(--admin-border)',
                        borderRadius: 8,
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '0.25rem',
                      }}
                      title={`Inspect Component #${crop.index}`}
                    >
                      <img
                        src={crop.dataUrl}
                        alt={`Component ${crop.index}`}
                        style={{ width: '100%', aspectRatio: '1 / 1', objectFit: 'contain', background: 'var(--admin-crop-preview-bg)', borderRadius: 4, border: '1px solid var(--admin-border)' }}
                      />
                      <span style={{ fontSize: '0.65rem', color: 'var(--admin-ink-muted)' }}>
                        #{crop.index} · {crop.pixelCount}px
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Component Detail Modal ── */}
      {selectedCropIndex !== null && selectedCrop && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'var(--admin-modal-backdrop)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '1.5rem',
          }}
          onClick={closeDetailModal}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 420,
              background: 'var(--admin-paper)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--admin-border)',
              boxShadow: 'var(--admin-modal-shadow)',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontSize: '1.25rem' }}>
                  Symbol Component #{selectedCrop.index}
                </h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--admin-ink-muted)' }}>
                  {selectedCropIndex + 1} of {analysis?.rawCrops.length} detected marks
                </span>
              </div>

              <button
                type="button"
                onClick={closeDetailModal}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--admin-ink-muted)',
                  padding: 4,
                }}
              >
                <XIcon size={20} />
              </button>
            </div>

            <div
              style={{
                width: '100%',
                aspectRatio: '1 / 1',
                background: 'var(--admin-crop-preview-bg)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '1rem',
                border: '1px solid var(--admin-border)',
              }}
            >
              <img
                src={selectedCrop.dataUrl}
                alt={`Component ${selectedCrop.index}`}
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '0.75rem',
                fontSize: '0.8rem',
                background: 'var(--admin-paper-muted)',
                padding: '0.75rem',
                borderRadius: 8,
              }}
            >
              <div>
                <span style={{ color: 'var(--admin-ink-muted)' }}>Pixel Count:</span>{' '}
                <b>{selectedCrop.pixelCount} px</b>
              </div>
              <div>
                <span style={{ color: 'var(--admin-ink-muted)' }}>Dimensions:</span>{' '}
                <b>{selectedCrop.bbox.width} × {selectedCrop.bbox.height} px</b>
              </div>
              <div>
                <span style={{ color: 'var(--admin-ink-muted)' }}>Bounding Center:</span>{' '}
                <b>({Math.round(selectedCrop.center.x)}, {Math.round(selectedCrop.center.y)})</b>
              </div>
              <div>
                <span style={{ color: 'var(--admin-ink-muted)' }}>Origin:</span>{' '}
                <b>X:{selectedCrop.bbox.x} Y:{selectedCrop.bbox.y}</b>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                type="button"
                disabled={selectedCropIndex === 0}
                onClick={() => setSelectedCropIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : prev))}
                className="admin-btn admin-btn-secondary"
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}
              >
                <CaretLeftIcon size={16} /> Previous
              </button>
              <button
                type="button"
                disabled={analysis ? selectedCropIndex === analysis.rawCrops.length - 1 : true}
                onClick={() =>
                  setSelectedCropIndex((prev) =>
                    analysis && prev !== null && prev < analysis.rawCrops.length - 1 ? prev + 1 : prev
                  )
                }
                className="admin-btn admin-btn-secondary"
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}
              >
                Next <CaretRightIcon size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Save Glyph to Catalog ── */}
      <SaveGlyphModal
        isOpen={saveModalOpen}
        onClose={() => setSaveModalOpen(false)}
        onSave={handleSaveGlyphSubmit}
        previewImage={saveGlyphPreview}
        defaultName={saveGlyphName}
        defaultDescription={saveGlyphDesc}
        defaultElement={saveGlyphElement}
        defaultTier={saveGlyphTier}
        defaultIsPublic={false} // Admin saves might be public by default, but let user choose
        detectedComponentsCount={analysis?.summary.totalComponents}
        identifiedCenterLabel={analysis?.semanticCrops.effector.recognition.label || undefined}
        isWorkshop={false}
      />

      {/* ── Dedicated Saved Models Explorer Section at the Bottom ── */}
      <div style={{ marginTop: '3rem' }}>
        <SavedModelsExplorer currentSigilLabel="Glyph Composite Studio" />
      </div>
    </div>
  );
};
