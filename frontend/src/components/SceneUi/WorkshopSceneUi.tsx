import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import {
  PauseIcon,
  PlayIcon,
  HouseIcon,
  FloppyDiskIcon,
  EyeIcon,
  EyeSlash as EyeSlashIcon,
  CompassIcon,
  CheckCircle as CheckCircleIcon,
  WarningCircle as WarningCircleIcon,
  CircleDashed as CircleDashedIcon,
  CircleNotch as CircleNotchIcon,
} from '@phosphor-icons/react';
import toast from 'react-hot-toast';
import { useGameStore } from '../../lib/stores/store';
import { useAdminGlyphsStore } from '../../lib/stores/admin_glyphs_store';
import { useAdminSigilsStore } from '../../lib/stores/admin_sigils_store';
import { Sigil, Element as GlyphElement } from '../../types/glyph_types';
import { generateUUID } from '../../lib/uuid';
import { DrawingCanvas, DrawingCanvasRef } from '../DrawingCanvas';
import { SaveGlyphModal } from '../SaveGlyphModal';
import {
  analyzeGlyphComposition,
  GlyphCompositionAnalysis,
  SegmentedCrop,
} from '../../lib/ml/glyph_semantic_engine';
import { checkSolidityFromAnalysis, getCanvasSigilErrors, CanvasSigilError, isSolid, defaultResolveSigilId, buildCompositionFromAnalysis } from '../../lib/glyph_helpers/glyph_solidity';
import { isEnclosingCircleOpen, detectEnclosingCircle } from '../../lib/glyph_helpers/glyph_detection';
import { useAuth } from '../../lib/supabase/auth/useAuth';
import { GlyphSemanticDiagramPopup } from '../GlyphSemanticDiagramPopup';

import { WorkshopCatalog } from '../WorkshopCatalogMenu/WorkshopCatalog';
import { WorkshopGlyphItem } from '../WorkshopCatalogMenu/GlyphCard';
import { GlyphDetailsPopup } from '../WorkshopCatalogMenu/GlyphDetailsPopup';
import { ConfirmationModal } from '../Common/ConfirmationModal';
import { loadGlyphIntoCanvas } from '../../lib/glyph_helpers/glyph_canvas_loader';
import { saveGlyphApi } from '../../lib/apis/api';
import { syncGlyph } from '../../lib/admin_utils/sync_helpers';
import { removeImageBackground } from '../../lib/admin_utils/background_remover';
import { GlyphDiagnosticsOverlay } from '../DrawingPad/GlyphDiagnosticsOverlay';
import { useWorkshopDraftStore } from '../../lib/stores/workshop_draft_store';



export const WorkshopSceneUi: React.FC = () => {
  const activeScreen = useGameStore((state) => state.activeScreen);
  const setScreen = useGameStore((state) => state.setScreen);
  const resetGameSession = useGameStore((state) => state.resetGameSession);

  const { user } = useAuth();
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const { glyphs, loadRemoteGlyphs, addGlyph, deleteGlyph, clearDraft, isLoadingRemote: isLoadingGlyphs } = useAdminGlyphsStore();
  const { sigils, loadRemoteSigils, isLoadingRemote: isLoadingSigils } = useAdminSigilsStore();
  const { drafts: glyphDrafts } = useAdminGlyphsStore();
  const { drafts: sigilDrafts } = useAdminSigilsStore();
  const workshopDraft = useWorkshopDraftStore((s) => s.workshopDraft);
  const workshopDraftStrokes = useWorkshopDraftStore((s) => s.workshopDraftStrokes);
  const setWorkshopDraft = useWorkshopDraftStore((s) => s.setWorkshopDraft);
  const clearWorkshopDraft = useWorkshopDraftStore((s) => s.clearWorkshopDraft);
  const setLiveStrokes = useWorkshopDraftStore((s) => s.setLiveStrokes);
  const setActiveGlyphId = useWorkshopDraftStore((s) => s.setActiveGlyphId);
  const clearLiveSession = useWorkshopDraftStore((s) => s.clearLiveSession);
  const [isSyncingDraft, setIsSyncingDraft] = useState(false);

  // --- Drawing canvas ref & recognition state ---
  const drawCanvasRef = useRef<DrawingCanvasRef>(null);
  const [hasStrokes, setHasStrokes] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [analysis, setAnalysis] = useState<GlyphCompositionAnalysis | null>(null);
  const [showBounds, setShowBounds] = useState(false);

  // Restore live draft strokes from persistent session on mount
  useEffect(() => {
    const initialStrokes = useWorkshopDraftStore.getState().activeStrokes;
    if (initialStrokes && initialStrokes.length > 0) {
      const timer = setTimeout(() => {
        if (drawCanvasRef.current) {
          drawCanvasRef.current.loadStrokes(initialStrokes);
          setHasStrokes(true);
        }
      }, 60);
      return () => clearTimeout(timer);
    }
  }, []);

  // --- Sigil ID resolver (matches a label to a known sigil) ---
  const resolveSigilId = useCallback((label?: string | null) => {
    return defaultResolveSigilId(label, sigils);
  }, [sigils]);

  // --- Live solidity analysis derived from current recognition ---
  const solidityAnalysis = useMemo(() => {
    if (!analysis) return null;
    return checkSolidityFromAnalysis(analysis, sigils, resolveSigilId);
  }, [analysis, sigils, resolveSigilId]);

  const glyphIsSolid = solidityAnalysis?.isSolid ?? false;

  // --- Active Glyph (the drawn glyph on the atelier canvas) ---
  const [activeGlyph, setActiveGlyph] = useState<WorkshopGlyphItem | null>(null);

  // --- Multi-select glyphs for Testing Ground (activeGlyph is default and 1st item) ---
  const [selectedGlyphs, setSelectedGlyphs] = useState<WorkshopGlyphItem[]>([]);
  const startTestingGround = useGameStore((state) => state.startTestingGround);

  // Keep activeGlyph as the first element of selectedGlyphs whenever it updates
  useEffect(() => {
    if (activeGlyph) {
      setSelectedGlyphs((prev) => {
        const withoutActive = prev.filter((g) => g.id !== activeGlyph.id && g.id !== 'active-workshop-glyph');
        return [activeGlyph, ...withoutActive];
      });
    }
  }, [activeGlyph]);

  const handleToggleSelectGlyph = useCallback((glyph: WorkshopGlyphItem) => {
    setSelectedGlyphs((prev) => {
      const exists = prev.some((g) => g.id === glyph.id);
      if (exists) {
        return prev.filter((g) => g.id !== glyph.id);
      }
      return [...prev, glyph];
    });
  }, []);

  const handleEnterTestingGround = useCallback(() => {
    if (selectedGlyphs.length === 0) {
      toast.error('Please select at least one glyph from the catalog to test.');
      return;
    }
    startTestingGround(selectedGlyphs);
  }, [selectedGlyphs, startTestingGround]);

  // --- Glyph Details Popup & Overwrite Warning State ---
  const [detailsGlyph, setDetailsGlyph] = useState<WorkshopGlyphItem | null>(null);
  const [pendingLoadGlyph, setPendingLoadGlyph] = useState<WorkshopGlyphItem | null>(null);
  const [isOverwriteModalOpen, setIsOverwriteModalOpen] = useState(false);

  // Execute loading the glyph into the canvas pad
  const executeLoadGlyph = useCallback(async (glyph: WorkshopGlyphItem) => {
    let targetGlyph = glyph;
    // If strokes were omitted from catalog item, resolve from admin store or workshop draft store
    if (!targetGlyph.composition?.strokes || targetGlyph.composition.strokes.length === 0) {
      const adminItem = useAdminGlyphsStore.getState().getGlyphById(glyph.id);
      if (adminItem?.composition?.strokes && adminItem.composition.strokes.length > 0) {
        targetGlyph = {
          ...targetGlyph,
          composition: {
            ...targetGlyph.composition,
            strokes: adminItem.composition.strokes,
          },
        };
      } else {
        const wsDraft = useWorkshopDraftStore.getState().workshopDraft;
        const wsStrokes = useWorkshopDraftStore.getState().workshopDraftStrokes;
        if (wsStrokes && wsStrokes.length > 0 && (wsDraft?.id === glyph.id || glyph.isDraft)) {
          targetGlyph = {
            ...targetGlyph,
            composition: {
              ...targetGlyph.composition,
              strokes: wsStrokes,
            },
          };
        }
      }
    }

    const success = await loadGlyphIntoCanvas(drawCanvasRef.current, targetGlyph);
    if (success) {
      setHasStrokes(true);
      const loadedStrokes = drawCanvasRef.current?.getStrokes() || [];
      if (loadedStrokes.length > 0) {
        setLiveStrokes(loadedStrokes);
      }

      // Create a brand new draft copy rather than reusing the original glyph's ID
      const newDraftId = generateUUID();
      const draftCopyName = glyph.name.endsWith('(Copy)') || glyph.name.endsWith('(Draft)')
        ? glyph.name
        : `${glyph.name} (Copy)`;

      const draftCopy: WorkshopGlyphItem = {
        ...targetGlyph,
        id: newDraftId,
        name: draftCopyName,
        description: glyph.description || 'Draft formation copied from catalog.',
        isDraft: true,
        author: user?.email || 'You',
        createdAt: 'Just now',
        composition: {
          ...targetGlyph.composition,
          strokes: loadedStrokes.length > 0 ? loadedStrokes : targetGlyph.composition?.strokes,
        },
      };

      setActiveGlyph(draftCopy);
      setActiveGlyphId(newDraftId);
      setPendingLoadGlyph(null);
      setIsOverwriteModalOpen(false);

      toast.success(`Loaded "${draftCopyName}" as a new draft!`);
    } else {
      toast.error('Failed to load glyph into canvas.');
    }
  }, [user, setLiveStrokes, setActiveGlyphId]);

  // Request loading glyph — checks for existing strokes to display safety warning modal
  const handleRequestLoadGlyph = useCallback((glyph: WorkshopGlyphItem) => {
    const canvas = drawCanvasRef.current;
    if (hasStrokes || (canvas && !canvas.isEmpty())) {
      setPendingLoadGlyph(glyph);
      setIsOverwriteModalOpen(true);
    } else {
      executeLoadGlyph(glyph);
    }
  }, [hasStrokes, executeLoadGlyph]);

  // --- Formation Diagram & Error Highlights State ---
  const [dismissedErrors, setDismissedErrors] = useState<Record<string, boolean>>({});
  const [bubbleSessionId, setBubbleSessionId] = useState(0);

  // Extract sigil error bounding boxes & details from current analysis & solidity
  const canvasSigilErrors = useMemo(() => {
    return getCanvasSigilErrors(analysis, solidityAnalysis);
  }, [analysis, solidityAnalysis]);

  // --- Recognition handler (ported from GlyphTestingPage) ---
  const handleRecognizeGlyph = useCallback(async () => {
    const canvas = drawCanvasRef.current?.getCanvasElement();
    if (!canvas || drawCanvasRef.current?.isEmpty()) {
      toast.error('Please draw one or more glyph symbols on the pad first.');
      return { isSolid: false, glyph: null };
    }

    setIsProcessing(true);
    try {
      const result = await analyzeGlyphComposition(canvas);
      setAnalysis(result);
      setBubbleSessionId((prev) => prev + 1);
      setDismissedErrors({});

      // Create/Update the activeGlyph representation from this recognized drawing
      const effLabel = result.semanticCrops?.effector?.recognition?.label || '';
      let detectedElement: GlyphElement = 'fire';
      if (effLabel.includes('water')) detectedElement = 'water';
      else if (effLabel.includes('earth')) detectedElement = 'earth';
      else if (effLabel.includes('air')) detectedElement = 'air';

      // Capture and trim the canvas to only the drawn bounding box
      let croppedBase64 = canvas.toDataURL('image/png');
      try {
        croppedBase64 = await removeImageBackground(croppedBase64, { autoTrim: true, removeHalo: false, contiguousOnly: false, tolerance: 0 });
      } catch (err) {
        console.warn("Failed to trim preview canvas", err);
      }

      const currentDrawnGlyph: WorkshopGlyphItem = {
        id: 'active-workshop-glyph',
        name: 'Drawn Formation',
        description: 'Active formation drawn on the workshop canvas.',
        element: detectedElement,
        tier: 1,
        author: user?.email || 'You',
        isPublic: false,
        createdAt: 'Now',
        confidenceScore: 0.88,
        coverAsset: croppedBase64,
        composition: {
          ...buildCompositionFromAnalysis(result, resolveSigilId, detectedElement),
          strokes: drawCanvasRef.current?.getStrokes(),
        },
        isDraft: true,
      };
      setActiveGlyph(currentDrawnGlyph);

      // Check whether the recognized formation meets the arcane solidity rules
      const solidity = checkSolidityFromAnalysis(result, sigils, resolveSigilId);

      if (!solidity.isSolid) {
        // Not solid yet: notify the user with diagnostic reasons
        if (result.rawCrops.length === 0) {
          toast('No distinct symbols detected on canvas.', { icon: '🔍' });
        } else if (solidity.reasons.length > 0) {
          toast.error(`Glyph not solid: ${solidity.reasons[0]}`);
        } else {
          toast.error('Glyph formation is not solid. Check diagnostic bubbles on canvas.');
        }
      }

      return { isSolid: solidity.isSolid, glyph: currentDrawnGlyph };
    } catch (err: any) {
      console.error('Glyph recognition error:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to process glyph symbols.');
      return { isSolid: false, glyph: null };
    } finally {
      setIsProcessing(false);
    }
  }, [user, sigils, resolveSigilId, drawCanvasRef]);

  // Action for the Test Glyph button
  const handleTestGlyphAction = useCallback(async () => {
    const { isSolid, glyph } = await handleRecognizeGlyph();
    if (isSolid && glyph) {
      const glyphsToTest = [
        glyph,
        ...selectedGlyphs.filter((g) => g.id !== 'active-workshop-glyph' && g.id !== glyph.id),
      ];

      toast.success('Glyph formation is solid! Transporting to Testing Grounds...', {
        icon: '✨',
        duration: 2500,
      });

      setTimeout(() => {
        startTestingGround(glyphsToTest);
      }, 500);
    }
  }, [handleRecognizeGlyph, selectedGlyphs, startTestingGround]);

  // Action for the Analyze button (runs analysis and displays results without changing scenes)
  const handleAnalyzeGlyphAction = useCallback(async () => {
    const { isSolid } = await handleRecognizeGlyph();
    if (isSolid) {
      toast.success('Glyph formation is solid and valid!', {
        icon: '✨',
        duration: 3000,
      });
    }
  }, [handleRecognizeGlyph]);

  // --- Detect enclosing boundary circle and closure metrics ---
  const circleDetectionResult = useMemo(() => {
    if (!analysis) return null;
    return detectEnclosingCircle(analysis, drawCanvasRef.current?.getCanvasElement());
  }, [analysis]);

  const isCircleOpen = useMemo(() => {
    if (!circleDetectionResult) return false;
    return circleDetectionResult.isOpen;
  }, [circleDetectionResult]);

  // --- Activate glyph stub (requires solidity) ---
  const activateGlyph = useCallback(() => {
    if (!glyphIsSolid) {
      toast.error('Glyph is not solid — all slots must pass validation before activation.');
      return;
    }

    // TODO: Implement glyph activation logic
  }, [glyphIsSolid]);

  useEffect(() => {
    loadRemoteSigils();
    loadRemoteGlyphs();
  }, [loadRemoteSigils, loadRemoteGlyphs]);

  const [myGlyphs, setMyGlyphs] = useState<WorkshopGlyphItem[]>([]);
  const [publicGlyphs, setPublicGlyphs] = useState<WorkshopGlyphItem[]>([]);

  // Convert AdminGlyphItem to WorkshopGlyphItem with real authenticated author
  useEffect(() => {
    const currentAuthor = user ? (user.email || user.id) : null;
    const workshopGlyphs: WorkshopGlyphItem[] = glyphs.map(g => ({
      id: g.id,
      name: g.name,
      description: g.description,
      element: g.element || 'fire',
      tier: g.tier,
      author: currentAuthor,
      isPublic: false, // In a real app, from db
      createdAt: new Date(g.createdAt).toLocaleDateString(),
      confidenceScore: g.confidenceScore,
      coverAsset: g.coverAsset,
      composition: g.composition,
      isDraft: !!glyphDrafts[g.id]
    }));

    setMyGlyphs(workshopGlyphs);
    setPublicGlyphs([]); // Dummy for now since we haven't implemented public sharing fully
  }, [glyphs, glyphDrafts, user]);

  const handleSelectAll = useCallback(() => {
    const map = new Map<string, WorkshopGlyphItem>();
    if (activeGlyph) map.set(activeGlyph.id, activeGlyph);
    for (const g of myGlyphs) map.set(g.id, g);
    for (const g of publicGlyphs) map.set(g.id, g);
    setSelectedGlyphs(Array.from(map.values()));
  }, [activeGlyph, myGlyphs, publicGlyphs]);

  const handleClearSelection = useCallback(() => {
    setSelectedGlyphs(activeGlyph ? [activeGlyph] : []);
  }, [activeGlyph]);

  const handleDeleteSelected = useCallback(() => {
    const toDelete = selectedGlyphs.filter((g) => g.id !== 'active-workshop-glyph');
    if (toDelete.length === 0) return;

    if (!window.confirm(`Are you sure you want to delete ${toDelete.length} selected glyph${toDelete.length > 1 ? 's' : ''}? This action cannot be undone.`)) {
      return;
    }

    toDelete.forEach((g) => {
      if (workshopDraft && g.id === workshopDraft.id) {
        clearWorkshopDraft();
      }
      deleteGlyph(g.id);
    });

    if (activeGlyph && toDelete.some((g) => g.id === activeGlyph.id)) {
      setActiveGlyph(null);
      drawCanvasRef.current?.clear();
      setHasStrokes(false);
      clearLiveSession();
    }

    setSelectedGlyphs((prev) => prev.filter((g) => !toDelete.some((d) => d.id === g.id)));
    toast.success(`Deleted ${toDelete.length} glyph${toDelete.length > 1 ? 's' : ''}.`);
  }, [selectedGlyphs, deleteGlyph, activeGlyph, clearLiveSession]);

  const menuSigils = useMemo(() => {
    const grouped: Record<string, Record<string, any[]>> = {};
    sigils.forEach((sigil) => {
      const type = sigil.type;
      const tierKey = `tier-${sigil.tier ?? 1}`;
      if (!grouped[type]) {
        grouped[type] = {};
      }
      if (!grouped[type][tierKey]) {
        grouped[type][tierKey] = [];
      }
      // Add draft property for tooltip
      grouped[type][tierKey].push({ ...sigil, isDraft: !!sigilDrafts[sigil.id] });
    });
    return grouped;
  }, [sigils, sigilDrafts]);

  const isPaused = activeScreen === 'PAUSED';

  // Save button action: if draft exists, sync it directly; otherwise open Save modal
  const handleSaveButtonClick = useCallback(async () => {
    if (workshopDraft) {
      if (isSyncingDraft) return;
      setIsSyncingDraft(true);
      try {
        const builtComp = analysis
          ? buildCompositionFromAnalysis(analysis, resolveSigilId, workshopDraft.element as any)
          : null;

        const comp = {
          effector: builtComp?.effector || workshopDraft.composition?.effector || { sigilId: `eff-${workshopDraft.element}` },
          directions: builtComp?.directions || workshopDraft.composition?.directions || {},
          formAugmentors: builtComp?.formAugmentors || workshopDraft.composition?.formAugmentors || {},
          strokes: workshopDraftStrokes || (workshopDraft.composition as any)?.strokes,
        };

        await syncGlyph({
          ...workshopDraft,
          composition: comp,
          coverAsset: workshopDraft.coverAsset,
        });
      } finally {
        setIsSyncingDraft(false);
      }
    } else {
      setIsSaveModalOpen(true);
    }
  }, [workshopDraft, workshopDraftStrokes, isSyncingDraft, analysis, resolveSigilId]);

  return (
    <div className="game-scene-overlay">
      {/* Top Header */}
      <header className="game-header interactive-ui">
        <div className="game-header-brand">
          <div className="game-header-titles">
            <h2 className="game-header-title">GLYPH ATELIER</h2>
            <span className="game-header-subtitle">Runic Inscription & Synthesis</span>
          </div>
        </div>

        {/* Navigation Buttons */}
        <div className="game-header-actions">
          <button
            onClick={resetGameSession}
            className="header-action-btn"
            title="Return to Main Sanctuary"
            aria-label="Return to Main Sanctuary"
          >
            <HouseIcon size={17} weight="bold" />
          </button>
          <button
            onClick={() => setScreen(isPaused ? 'IN_GAME' : 'PAUSED')}
            className={`header-action-btn ${isPaused ? 'active' : ''}`}
            title={isPaused ? "Resume Session" : "Pause Session"}
            aria-label={isPaused ? "Resume Session" : "Pause Session"}
          >
            {isPaused ? (
              <>
                <PlayIcon size={17} weight="fill" style={{ color: 'var(--color-accent)' }} />
                <span className="header-btn-label">Resume</span>
              </>
            ) : (
              <>
                <PauseIcon size={17} weight="bold" />
                <span className="header-btn-label">Pause</span>
              </>
            )}
          </button>
        </div>
      </header>

      <div className="game-scene-content">
        <WorkshopCatalog
          menuSigils={menuSigils}
          myGlyphs={myGlyphs.filter((g) => g.id !== activeGlyph?.id && g.id !== 'active-workshop-glyph')}
          publicGlyphs={publicGlyphs.filter((g) => g.id !== activeGlyph?.id && g.id !== 'active-workshop-glyph')}
          workshopDraft={workshopDraft}
          activeGlyphId={activeGlyph?.id}
          isLoading={isLoadingSigils || isLoadingGlyphs}
          selectedGlyphs={selectedGlyphs}
          onToggleSelectGlyph={handleToggleSelectGlyph}
          onSelectAll={handleSelectAll}
          onClearSelection={handleClearSelection}
          onDeleteSelected={handleDeleteSelected}
          onEnterTestingGround={handleEnterTestingGround}
          onOpenGlyphDetails={(glyph) => setDetailsGlyph(glyph)}
        />

        <div className="drawing-area" style={{ position: 'relative' }}>
          <DrawingCanvas
            ref={drawCanvasRef}
            showGuide={true}
            showToolbar={true}
            fixedBrushSize={false}
            onStrokesChange={(strokes) => {
              const has = strokes.length > 0;
              setHasStrokes(has);
              if (has) {
                setLiveStrokes(strokes);
              } else {
                clearLiveSession();
              }
            }}
          />

          {/* Modular SVG Error Bounding Boxes & Directional Suggestion Speech Bubbles Overlay */}
          <GlyphDiagnosticsOverlay
            errors={canvasSigilErrors}
            canvasElement={drawCanvasRef.current?.getCanvasElement()}
            dismissedErrors={dismissedErrors}
            onDismissError={(key) => setDismissedErrors((prev) => ({ ...prev, [key]: true }))}
            sessionId={bubbleSessionId}
          />

          {/* Top-left Arcane Status Cluster: Enclosing Circle, Solidity, and Bounds Toggle */}
          {analysis && (
            <div
              style={{
                position: 'absolute',
                top: '1rem',
                left: '1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                zIndex: 10,
                flexWrap: 'wrap',
              }}
            >
              {/* Enclosing Circle Status Pill */}
              {circleDetectionResult && (
                <span
                  style={{
                    padding: '0.4rem 0.8rem',
                    borderRadius: 9999,
                    background: !circleDetectionResult.hasCircle
                      ? 'rgba(44, 40, 38, 0.75)'
                      : circleDetectionResult.isClosed
                      ? 'rgba(6, 78, 59, 0.85)'
                      : 'rgba(120, 53, 15, 0.85)',
                    color: !circleDetectionResult.hasCircle
                      ? '#d1c7b7'
                      : circleDetectionResult.isClosed
                      ? '#a7f3d0'
                      : '#fde68a',
                    border: `1.5px solid ${
                      !circleDetectionResult.hasCircle
                        ? 'rgba(200, 190, 173, 0.3)'
                        : circleDetectionResult.isClosed
                        ? '#34d399'
                        : '#fbbf24'
                    }`,
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    backdropFilter: 'blur(8px)',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
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
                      Circle: None
                    </>
                  ) : circleDetectionResult.isClosed ? (
                    <>
                      <CheckCircleIcon size={14} weight="bold" />
                      Circle: Closed
                    </>
                  ) : (
                    <>
                      <WarningCircleIcon size={14} weight="bold" />
                      Circle: Open
                    </>
                  )}
                </span>
              )}

              {/* Solidity Status Pill */}
              <span
                style={{
                  padding: '0.4rem 0.8rem',
                  borderRadius: 9999,
                  background: glyphIsSolid ? 'rgba(6, 78, 59, 0.85)' : 'rgba(120, 53, 15, 0.85)',
                  color: glyphIsSolid ? '#a7f3d0' : '#fde68a',
                  border: `1.5px solid ${glyphIsSolid ? '#34d399' : '#fbbf24'}`,
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  backdropFilter: 'blur(8px)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
                }}
              >
                {glyphIsSolid ? (
                  <>
                    <CheckCircleIcon size={14} weight="bold" />
                    Formation: Solid
                  </>
                ) : (
                  <>
                    <WarningCircleIcon size={14} weight="bold" />
                    Formation: Incomplete
                  </>
                )}
              </span>

              {/* Show Bounds Toggle Button */}
              <button
                onClick={() => setShowBounds((prev) => !prev)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.4rem 0.8rem',
                  borderRadius: 9999,
                  background: showBounds ? 'rgba(160, 124, 52, 0.95)' : 'rgba(44, 40, 38, 0.75)',
                  color: showBounds ? '#ffffff' : '#e5be49',
                  border: `1.5px solid ${showBounds ? '#e5be49' : 'rgba(229, 190, 73, 0.5)'}`,
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  backdropFilter: 'blur(8px)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
                  transition: 'all 0.2s ease',
                }}
                title={showBounds ? 'Hide semantic detection boundaries' : 'Show semantic detection boundaries'}
              >
                {showBounds ? <EyeSlashIcon size={14} weight="bold" /> : <EyeIcon size={14} weight="bold" />}
                Bounds
              </button>
            </div>
          )}

          {/* Debug Bounding Boxes & Geometric Visualizer (Toggled by Bounds button) */}
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
                {/* 1. Diagonal Corner Search Zones (NW, NE, SW, SE) */}
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

                {/* 2. Corner Form Sigils (Purple) */}
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

                {/* 3. Cardinal Direction Anchor Bounding Boxes (Cyan) */}
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

                {/* 5. Raw component marks (Green dashed) */}
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

              {/* Bottom Legend Overlay */}
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

          {/* Floating action buttons — top-right cluster */}
          <div className="drawing-actions-cluster">
            {/* Analyze Button (Runs recognition analysis without changing scenes) */}
            <button
              onClick={handleAnalyzeGlyphAction}
              disabled={isProcessing || !hasStrokes}
              className={`analyze-glyph-btn ${glyphIsSolid ? 'is-solid' : hasStrokes ? 'is-ready' : 'is-dormant'}${isProcessing ? ' is-processing' : ''}`}
              title={
                hasStrokes
                  ? 'Analyze drawn glyph formation without changing scenes'
                  : 'Draw symbols on the canvas to analyze'
              }
            >
              <span className="analyze-glyph-label">{isProcessing ? 'Analyzing…' : 'Analyze'}</span>
            </button>

            {/* Test Glyph Button (Active when strokes are drawn; shows solid pulse beacon when verified solid) */}
            <button
              onClick={handleTestGlyphAction}
              disabled={isProcessing || !hasStrokes}
              className={`test-glyph-btn ${glyphIsSolid ? 'is-solid' : hasStrokes ? 'is-ready' : 'is-dormant'}${isProcessing ? ' is-processing' : ''}`}
              title={
                hasStrokes
                  ? glyphIsSolid
                    ? 'Formation is solid! Test glyph'
                    : 'Analyze drawn glyph formation'
                  : 'Draw symbols on the canvas to test'
              }
            >

              <span className="test-glyph-label">{isProcessing ? 'Analyzing…' : 'Test Glyph'}</span>

            </button>

            {/* Save Glyph Floating Button: Syncs draft directly if present, else opens modal */}
            <button
              onClick={handleSaveButtonClick}
              disabled={isSyncingDraft}
              title={
                workshopDraft
                  ? `Sync draft "${workshopDraft.name}" to database`
                  : 'Save Glyph'
              }
              aria-label={workshopDraft ? 'Sync Draft' : 'Save Glyph'}
              className={`save-glyph-floating-btn ${workshopDraft ? 'has-draft' : ''}`}
            >
              {isSyncingDraft ? (
                <CircleNotchIcon size={18} className="badge-spin" weight="bold" />
              ) : (
                <FloppyDiskIcon size={18} weight="fill" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Save Glyph Modal */}
      <SaveGlyphModal
        isOpen={isSaveModalOpen}
        user={user}
        defaultName={activeGlyph?.name !== 'Drawn Formation' ? activeGlyph?.name : undefined}
        defaultDescription={activeGlyph?.description !== 'Active formation drawn on the workshop canvas.' ? activeGlyph?.description : undefined}
        defaultElement={activeGlyph?.element as any}
        defaultTier={activeGlyph?.tier}
        onClose={() => setIsSaveModalOpen(false)}
        onDelete={activeGlyph?.id && activeGlyph.id !== 'active-workshop-glyph' ? async () => {
          if (workshopDraft && activeGlyph.id === workshopDraft.id) {
            clearWorkshopDraft();
          }
          deleteGlyph(activeGlyph.id);
          setActiveGlyph(null);
          drawCanvasRef.current?.clear();
          setHasStrokes(false);
          clearLiveSession();
          setSelectedGlyphs((prev) => prev.filter((g) => g.id !== activeGlyph.id));
          toast.success('Glyph deleted successfully.');
        } : undefined}
        onSave={async (data) => {
          // Preserve and reuse the active glyph's ID if one exists, otherwise generate a UUID
          const glyphId = (activeGlyph?.id && activeGlyph.id !== 'active-workshop-glyph')
            ? activeGlyph.id
            : generateUUID();
          const elem = (data.element as any) || 'fire';
          const cover = activeGlyph?.coverAsset || `/sigils/svg/eff-${elem}.svg`;

          const currentStrokes = drawCanvasRef.current?.getStrokes() || [];
          const builtComp = analysis
            ? buildCompositionFromAnalysis(analysis, resolveSigilId, elem)
            : null;

          const compositionToSave = {
            effector: builtComp?.effector || {
              sigilId: `eff-${elem}`,
              label: `${elem} Effector`,
              element: elem,
            },
            directions: builtComp?.directions || {},
            formAugmentors: builtComp?.formAugmentors || {},
            strokes: currentStrokes,
          };

          // 1. Add/update locally as draft with active glyph ID (preserving full vector strokes)
          const added = addGlyph({
            id: glyphId,
            name: data.name || 'Custom Crafted Glyph',
            description: data.description || 'Mystical glyph woven in the workshop.',
            element: elem,
            tier: data.tier || 1,
            coverAsset: cover,
            composition: compositionToSave,
          });

          setActiveGlyph({
            id: glyphId,
            name: added.name,
            description: added.description,
            element: (added.element as any) || 'fire',
            tier: added.tier || 1,
            author: (data as any)?.author || user?.user_metadata?.full_name || 'You',
            isPublic: Boolean(data.isPublic),
            createdAt: 'Just now',
            confidenceScore: 0.95,
            coverAsset: added.coverAsset || `/sigils/svg/eff-${elem}.svg`,
            composition: added.composition,
          });

          // Store as current single workshop draft locally
          setWorkshopDraft({
            id: glyphId,
            name: added.name,
            description: added.description,
            element: (added.element as any) || 'fire',
            tier: added.tier || 1,
            author: (data as any)?.author || user?.user_metadata?.full_name || 'You',
            isPublic: Boolean(data.isPublic),
            createdAt: 'Just now',
            confidenceScore: 0.95,
            coverAsset: added.coverAsset || `/sigils/svg/eff-${elem}.svg`,
            composition: {
              ...added.composition,
              strokes: currentStrokes,
            },
          }, currentStrokes);

          // 2. Attempt Edge Function save with the exact glyph ID
          try {
            await saveGlyphApi({
              id: glyphId,
              name: added.name,
              description: added.description,
              element: added.element || 'fire',
              tier: added.tier,
              isPublic: Boolean(data.isPublic),
              composition: added.composition,
              coverImageBase64: added.coverAsset,
            });
            clearDraft(added.id);
            clearWorkshopDraft();
            await loadRemoteGlyphs();
            toast.success(`Saved "${added.name}" to database!`);
          } catch (edgeErr: any) {
            console.warn('save-glyph edge function skipped or failed:', edgeErr);
            toast(`Saved "${added.name}" locally as draft (Sign in to sync to cloud)`, { icon: '📝' });
          }

          setIsSaveModalOpen(false);
        }}
        isWorkshop={true}
        isSolid={glyphIsSolid}
      />

      {/* Pause Menu Overlay */}
      {isPaused && (
        <div className="modal-overlay">
          <div className="pause-modal">
            <h3>GAME PAUSED</h3>

            <div className="pause-modal-actions">
              <button
                onClick={() => setScreen('IN_GAME')}
                className="btn btn-primary"
              >
                Resume Game
              </button>

              <button
                onClick={resetGameSession}
                className="btn btn-secondary"
              >
                <HouseIcon size={16} />
                Return to Main Menu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Semantic Formation Diagram Floating Popup (bottom-right) */}
      <GlyphSemanticDiagramPopup
        analysis={analysis}
        solidity={solidityAnalysis}
        isCircleOpen={isCircleOpen}
        circleDetection={circleDetectionResult}
        canvasErrors={canvasSigilErrors}
      />

      {/* Glyph Details Popup (Opened when clicking a catalog glyph item) */}
      <GlyphDetailsPopup
        glyph={detailsGlyph}
        isOpen={!!detailsGlyph}
        isSelected={detailsGlyph ? selectedGlyphs.some((g) => g.id === detailsGlyph.id) : false}
        onClose={() => setDetailsGlyph(null)}
        onDelete={() => detailsGlyph && deleteGlyph(detailsGlyph.id)}
        onLoadIntoCanvas={handleRequestLoadGlyph}
        onToggleSelect={handleToggleSelectGlyph}
      />

      {/* Reusable Canvas Overwrite Safety Confirmation Warning */}
      <ConfirmationModal
        isOpen={isOverwriteModalOpen}
        title="Overwrite Drawing Pad?"
        message={`Loading "${pendingLoadGlyph?.name || 'this glyph'}" will replace your current drawing strokes on the pad. Are you sure you want to proceed?`}
        confirmLabel="Overwrite & Load"
        cancelLabel="Keep Current Drawing"
        isDanger={true}
        onConfirm={() => {
          if (pendingLoadGlyph) {
            executeLoadGlyph(pendingLoadGlyph);
          }
        }}
        onCancel={() => {
          setPendingLoadGlyph(null);
          setIsOverwriteModalOpen(false);
        }}
      />
    </div>
  );
};
