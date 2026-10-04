import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { SplitButton } from '../../components/Common/SplitButton';
import {
  Sparkle as SparkleIcon,
  DownloadSimple as DownloadIcon,
  Sliders as SlidersIcon,
  ArrowCounterClockwise as ResetIcon,
  Eye as EyeIcon,
  ArrowsClockwise as SyncIcon,
  Check as CheckIcon,
  FileArrowUp as UploadIcon,
  Play as PlayIcon,
  Pause as PauseIcon,
  GridFour as GridIcon,
  ArrowUp as ArrowUpIcon,
  ArrowDown as ArrowDownIcon,
  ArrowLeft as ArrowLeftIcon,
  ArrowRight as ArrowRightIcon,
  CaretLeft as CaretLeftIcon,
  CaretRight as CaretRightIcon,
  Compass as CompassIcon,
  Gear as GearIcon,
  X as CloseIcon,
  FileText as FileTextIcon,
  Plus as PlusIcon,
} from '@phosphor-icons/react';
import {
  ColorRGB,
  BoundingBox,
  NormalizationConfig,
  DEFAULT_NORMALIZATION,
  hexToRgb,
  removeChromaBackground,
  getNonTransparentBounds,
  normalizeSpritePadding,
  downscaleNearestNeighbor,
  generateSpriteSheet,
  downloadCanvasAsPng,
  loadImageFromFile,
  loadImageFromUrl,
  SpriteSheetPaddingConfig,
} from '../../lib/sprites/spriteProcessor';
import { useSpriteStudioSettingsStore } from '../../lib/stores/spriteStudioSettingsStore';
import { useSpriteTransferStore } from '../../lib/stores/spriteTransferStore';
import { SpriteSheetImportModal, SlicedFrameResult } from './SpriteSheetImportModal';

type DirectionKey = string;

interface DirectionSlot {
  key: DirectionKey;
  label: string;
  sublabel: string;
  sourceImage: HTMLImageElement | null;
  fileName: string | null;
  normalizedCanvas: HTMLCanvasElement | null;
  downscaledCanvas: HTMLCanvasElement | null;
  bounds: BoundingBox | null;
  rawBounds?: BoundingBox | null;
  topHeadroomPx: number;

  // Frame-specific settings overrides
  normConfig?: NormalizationConfig;
  chromaHex?: string;
  tolerance?: number;
  smoothness?: number;
  cleanUpEdges?: number;
}

const INITIAL_SLOTS: Record<DirectionKey, Omit<DirectionSlot, 'key'>> = {
  S: { label: 'South (Front)', sublabel: 'Canonical Idle Anchor', sourceImage: null, fileName: null, normalizedCanvas: null, downscaledCanvas: null, bounds: null, rawBounds: null, topHeadroomPx: 0 },
  W: { label: 'West (Left)', sublabel: 'Left-Facing Profile', sourceImage: null, fileName: null, normalizedCanvas: null, downscaledCanvas: null, bounds: null, rawBounds: null, topHeadroomPx: 0 },
  E: { label: 'East (Right)', sublabel: 'Right-Facing Profile', sourceImage: null, fileName: null, normalizedCanvas: null, downscaledCanvas: null, bounds: null, rawBounds: null, topHeadroomPx: 0 },
  N: { label: 'North (Back)', sublabel: 'Rear View Anchor', sourceImage: null, fileName: null, normalizedCanvas: null, downscaledCanvas: null, bounds: null, rawBounds: null, topHeadroomPx: 0 },
  SW: { label: 'South-West', sublabel: '3/4 Front-Left', sourceImage: null, fileName: null, normalizedCanvas: null, downscaledCanvas: null, bounds: null, rawBounds: null, topHeadroomPx: 0 },
  SE: { label: 'South-East', sublabel: '3/4 Front-Right', sourceImage: null, fileName: null, normalizedCanvas: null, downscaledCanvas: null, bounds: null, rawBounds: null, topHeadroomPx: 0 },
  NW: { label: 'North-West', sublabel: '3/4 Rear-Left', sourceImage: null, fileName: null, normalizedCanvas: null, downscaledCanvas: null, bounds: null, rawBounds: null, topHeadroomPx: 0 },
  NE: { label: 'North-East', sublabel: '3/4 Rear-Right', sourceImage: null, fileName: null, normalizedCanvas: null, downscaledCanvas: null, bounds: null, rawBounds: null, topHeadroomPx: 0 },
};

export const SpriteStudioPage: React.FC = () => {
  // Transfer store for incoming frames from VideoFramePickerPage or external slicers
  const { stagedFrames, clearStagedFrames } = useSpriteTransferStore();

  type AnchorMode = 'COMPASS' | 'NUMBERED';
  const [anchorMode, setAnchorMode] = useState<AnchorMode>('COMPASS');

  const [slotOrder, setSlotOrder] = useState<string[]>(['S', 'SW', 'W', 'NW', 'N', 'NE', 'E', 'SE']);
  // Slots state
  const [slots, setSlots] = useState<Record<DirectionKey, DirectionSlot>>(() => {
    const init: Record<string, DirectionSlot> = {};
    (['S', 'W', 'E', 'N', 'SW', 'SE', 'NW', 'NE'] as const).forEach((k) => {
      init[k] = { ...INITIAL_SLOTS[k], key: k };
    });
    return init as Record<DirectionKey, DirectionSlot>;
  });

  const [activeDirection, setActiveDirection] = useState<DirectionKey>('S');
  const [viewMode, setViewMode] = useState<'RAW' | 'NORMALIZED_1024' | 'DOWNSCALED_256' | 'PLAYER'>('NORMALIZED_1024');
  // Dedicated Sprite Studio Settings Store (persisted via Zustand / localStorage)
  const {
    chromaHex,
    tolerance,
    smoothness,
    cleanUpEdges,
    normConfig,
    previewBg,
    showGuides,
    zoomLevel,
    setChromaHex,
    setTolerance,
    setSmoothness,
    setCleanUpEdges,
    setNormConfig,
    setPreviewBg,
    setShowGuides,
    setZoomLevel,
    resetToDefaults,
    exportSettingsJson,
    importSettingsJson,
  } = useSpriteStudioSettingsStore();

  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [importBannerMsg, setImportBannerMsg] = useState<string | null>(null);
  const [isLoadingImage, setIsLoadingImage] = useState<boolean>(false);
  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);
  // Even padding lock: when true the bottom margin slider is disabled and
  // auto-computed as (100 - targetHeightPercent) / 2 whenever height changes
  const [isEvenPaddingLocked, setIsEvenPaddingLocked] = useState<boolean>(false);
  const settingsFileInputRef = useRef<HTMLInputElement | null>(null);

  // Track the last parameter group that was changed, so "Apply Last Change" knows what to broadcast
  type ChangeableParam = 'chromaHex' | 'tolerance' | 'smoothness' | 'cleanUpEdges' | 'normConfig';
  const lastChangedParamRef = useRef<ChangeableParam | null>(null);

  // Player preview animation state
  const [isPlayingRotation, setIsPlayingRotation] = useState<boolean>(false);
  const rotationIndexRef = useRef<number>(0);

  // Only scrub through loaded anchors (skips empty slots)
  const loadedDirections = useMemo(() => {
    return slotOrder.filter((k) => !!slots[k]?.sourceImage);
  }, [slots, slotOrder]);

  const scrubDirections = loadedDirections.length > 0 ? loadedDirections : slotOrder;

  // Canvas refs for drawing
  const mainPreviewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const targetUploadDirectionRef = useRef<DirectionKey | null>(null);

  const triggerUploadForSlot = (dirKey: DirectionKey) => {
    targetUploadDirectionRef.current = dirKey;
    fileInputRef.current?.click();
  };

  // Wipe a slot back to empty (used by the red X in the upload box)
  const clearSlot = (dirKey: DirectionKey) => {
    setSlots((prev) => ({
      ...prev,
      [dirKey]: {
        ...prev[dirKey],
        sourceImage: null,
        fileName: null,
        normalizedCanvas: null,
        downscaledCanvas: null,
        bounds: null,
        topHeadroomPx: 0,
      },
    }));
  };

  const activeSlot: DirectionSlot = slots[activeDirection] || slots[slotOrder[0]] || Object.values(slots)[0] || {
    key: activeDirection || 'S',
    label: activeDirection || 'S',
    sublabel: '',
    sourceImage: null,
    fileName: null,
    normalizedCanvas: null,
    downscaledCanvas: null,
    bounds: null,
    topHeadroomPx: 0,
  };

  const [autoCrouchScale, setAutoCrouchScale] = useState<boolean>(true);
  const isSyncingFromSlotRef = useRef<boolean>(false);

  // Auto-detect reference standing height across loaded frames
  // Averages the upper half of heights to isolate standard standing frames from crouch/bending outliers
  const calculatedReferenceHeight = useMemo(() => {
    if (!autoCrouchScale) return undefined;
    const loaded = Object.values(slots).filter((s) => s.sourceImage && s.rawBounds && s.rawBounds.height > 20);
    if (loaded.length < 2) return undefined;

    const heights = loaded.map((s) => s.rawBounds!.height).sort((a, b) => a - b);
    const upperHalf = heights.slice(Math.floor(heights.length / 2));
    const avgStanding = Math.round(upperHalf.reduce((sum, h) => sum + h, 0) / upperHalf.length);
    return avgStanding;
  }, [slots, autoCrouchScale]);

  // Process a single slot with its specific or overridden parameters
  const processSlot = (
    slot: DirectionSlot,
    configOverride?: NormalizationConfig,
    hexOverride?: string,
    tolOverride?: number,
    smOverride?: number,
    cleanOverride?: number,
    refHOverride?: number
  ): DirectionSlot => {
    if (!slot || !slot.sourceImage) {
      return { ...slot, normalizedCanvas: null, downscaledCanvas: null, bounds: null, rawBounds: null, topHeadroomPx: 0 };
    }

    const hex = hexOverride ?? slot.chromaHex ?? chromaHex;
    const tol = tolOverride ?? slot.tolerance ?? tolerance;
    const sm = smOverride ?? slot.smoothness ?? smoothness;
    const clean = cleanOverride ?? slot.cleanUpEdges ?? cleanUpEdges;
    const baseConfig = configOverride ?? slot.normConfig ?? normConfig;

    // Apply referenceHeight to preserve crouch/bend scale relative to standing frames
    const refH = refHOverride !== undefined ? refHOverride : (autoCrouchScale ? calculatedReferenceHeight : undefined);
    const config: NormalizationConfig = {
      ...baseConfig,
      referenceHeight: refH,
    };

    const chromaRGB = hexToRgb(hex);
    // 1. Remove chroma background with edge cleanup & despill
    const transparentCanvas = removeChromaBackground(slot.sourceImage, chromaRGB, tol, sm, clean);

    // 2. Find bounding box of non-transparent pixels on transparent canvas
    const rawBounds = getNonTransparentBounds(transparentCanvas);
    if (!rawBounds) {
      return { ...slot, normalizedCanvas: transparentCanvas, downscaledCanvas: null, bounds: null, rawBounds: null, topHeadroomPx: 0 };
    }

    // 3. Normalize padding & headroom onto 1024x1024
    const { canvas: normalizedCanvas, bounds: newBounds, topHeadroomPx } = normalizeSpritePadding(transparentCanvas, rawBounds, config);

    // 4. Downscale by 4x to 256x256 using nearest-neighbor
    const downscaledCanvas = downscaleNearestNeighbor(normalizedCanvas, config.outputLogicalSize);

    return {
      ...slot,
      normConfig: baseConfig,
      chromaHex: hex,
      tolerance: tol,
      smoothness: sm,
      cleanUpEdges: clean,
      normalizedCanvas,
      downscaledCanvas,
      bounds: newBounds,
      rawBounds,
      topHeadroomPx,
    };
  };

  // When activeDirection changes, synchronize UI sliders to the newly active frame's specific settings
  useEffect(() => {
    const slot = slots[activeDirection];
    if (!slot) return;

    isSyncingFromSlotRef.current = true;
    if (slot.normConfig) {
      setNormConfig(slot.normConfig);
    }
    if (slot.chromaHex) {
      setChromaHex(slot.chromaHex);
    }
    if (slot.tolerance !== undefined) {
      setTolerance(slot.tolerance);
    }
    if (slot.smoothness !== undefined) {
      setSmoothness(slot.smoothness);
    }
    if (slot.cleanUpEdges !== undefined) {
      setCleanUpEdges(slot.cleanUpEdges);
    }

    // If this slot has a source image but hasn't had its canvas generated, process it
    if (slot.sourceImage && !slot.normalizedCanvas) {
      setSlots((prev) => ({
        ...prev,
        [activeDirection]: processSlot(prev[activeDirection]),
      }));
    }

    const timer = setTimeout(() => {
      isSyncingFromSlotRef.current = false;
    }, 40);
    return () => clearTimeout(timer);
  }, [activeDirection]);

  // Track which parameter was last changed
  useEffect(() => {
    if (!isSyncingFromSlotRef.current) lastChangedParamRef.current = 'chromaHex';
  }, [chromaHex]);
  useEffect(() => {
    if (!isSyncingFromSlotRef.current) lastChangedParamRef.current = 'tolerance';
  }, [tolerance]);
  useEffect(() => {
    if (!isSyncingFromSlotRef.current) lastChangedParamRef.current = 'smoothness';
  }, [smoothness]);
  useEffect(() => {
    if (!isSyncingFromSlotRef.current) lastChangedParamRef.current = 'cleanUpEdges';
  }, [cleanUpEdges]);
  useEffect(() => {
    if (!isSyncingFromSlotRef.current) lastChangedParamRef.current = 'normConfig';
  }, [normConfig]);

  // Re-process active slot whenever parameters change (only modifies the currently active frame)
  useEffect(() => {
    if (isSyncingFromSlotRef.current) return;

    setSlots((prev) => {
      const updated = { ...prev };
      const current = updated[activeDirection];
      if (current && current.sourceImage) {
        updated[activeDirection] = processSlot(
          current,
          normConfig,
          chromaHex,
          tolerance,
          smoothness,
          cleanUpEdges
        );
      }
      return updated;
    });
  }, [chromaHex, tolerance, smoothness, cleanUpEdges, normConfig, autoCrouchScale, calculatedReferenceHeight]);

  // When animation reference standing height changes, synchronize relative crouch/bend scale across all loaded frames
  useEffect(() => {
    if (!calculatedReferenceHeight) return;
    setSlots((prev) => {
      let changed = false;
      const updated = { ...prev };
      Object.keys(updated).forEach((k) => {
        if (updated[k]?.sourceImage) {
          updated[k] = processSlot(updated[k], undefined, undefined, undefined, undefined, undefined, calculatedReferenceHeight);
          changed = true;
        }
      });
      return changed ? updated : prev;
    });
  }, [calculatedReferenceHeight]);

  // When even-padding is locked, keep bottomBaselinePercent in sync with targetHeightPercent
  useEffect(() => {
    if (!isEvenPaddingLocked) return;
    const evenMargin = Math.round((100 - normConfig.targetHeightPercent) / 2);
    if (normConfig.bottomBaselinePercent !== evenMargin) {
      setNormConfig({ bottomBaselinePercent: evenMargin });
    }
  }, [isEvenPaddingLocked, normConfig.targetHeightPercent]);

  // Apply active frame's settings across all uploaded slots
  const handleApplyToAll = useCallback(() => {
    setSlots((prev) => {
      const updated = { ...prev };
      const active = updated[activeDirection];
      const activeNorm = active?.normConfig ?? normConfig;
      const activeHex = active?.chromaHex ?? chromaHex;
      const activeTol = active?.tolerance ?? tolerance;
      const activeSm = active?.smoothness ?? smoothness;
      const activeClean = active?.cleanUpEdges ?? cleanUpEdges;

      slotOrder.forEach((k) => {
        if (updated[k]?.sourceImage) {
          updated[k] = processSlot(
            updated[k],
            activeNorm,
            activeHex,
            activeTol,
            activeSm,
            activeClean
          );
        }
      });
      return updated;
    });
  }, [activeDirection, normConfig, chromaHex, tolerance, smoothness, cleanUpEdges, slotOrder]);

  // Apply only the last-changed parameter to all uploaded slots, preserving each frame's other settings
  const handleApplyLastChange = useCallback(() => {
    const param = lastChangedParamRef.current;
    if (!param) return;

    setSlots((prev) => {
      const updated = { ...prev };
      const active = updated[activeDirection];

      slotOrder.forEach((k) => {
        if (k === activeDirection || !updated[k]?.sourceImage) return;
        const slot = updated[k];

        // Overlay only the last-changed parameter from the active frame
        const overrideNorm = param === 'normConfig' ? (active?.normConfig ?? normConfig) : undefined;
        const overrideHex = param === 'chromaHex' ? (active?.chromaHex ?? chromaHex) : undefined;
        const overrideTol = param === 'tolerance' ? (active?.tolerance ?? tolerance) : undefined;
        const overrideSm = param === 'smoothness' ? (active?.smoothness ?? smoothness) : undefined;
        const overrideClean = param === 'cleanUpEdges' ? (active?.cleanUpEdges ?? cleanUpEdges) : undefined;

        updated[k] = processSlot(
          slot,
          overrideNorm,
          overrideHex,
          overrideTol,
          overrideSm,
          overrideClean
        );
      });
      return updated;
    });
  }, [activeDirection, normConfig, chromaHex, tolerance, smoothness, cleanUpEdges, slotOrder]);

  // Helper to import an arbitrary number of frames into dynamic custom anchor slots
  const importFramesIntoSlots = (
    incoming: { name: string; canvas: HTMLCanvasElement; sourceImage?: HTMLImageElement }[],
    originLabel: string = 'imported'
  ) => {
    if (incoming.length === 0) return;

    const newSlots: Record<string, DirectionSlot> = {};
    const newOrder: string[] = [];

    incoming.forEach((item, idx) => {
      const key = `F${String(idx + 1).padStart(2, '0')}`;
      newOrder.push(key);

      const img = item.sourceImage || new Image();
      if (!item.sourceImage) {
        img.src = item.canvas.toDataURL('image/png');
      }

      const slot: DirectionSlot = {
        key,
        label: `Frame ${idx + 1}`,
        sublabel: item.name || `Frame ${idx + 1}`,
        sourceImage: img,
        fileName: `${item.name}.png`,
        normalizedCanvas: null,
        downscaledCanvas: null,
        bounds: null,
        topHeadroomPx: 0,
      };

      const handleImgLoad = () => {
        setSlots((prev) => {
          const existing = prev[key];
          if (existing) {
            return {
              ...prev,
              [key]: processSlot({ ...existing, sourceImage: img }),
            };
          }
          return prev;
        });
      };

      if (img.complete && img.naturalWidth > 0) {
        slot.sourceImage = img;
        const processed = processSlot(slot);
        newSlots[key] = processed;
      } else {
        img.onload = handleImgLoad;
        newSlots[key] = slot;
      }
    });

    setSlots(newSlots);
    setSlotOrder(newOrder);
    setAnchorMode('NUMBERED');
    setActiveDirection(newOrder[0]);
    setImportBannerMsg(
      `Successfully loaded ${incoming.length} frames from ${originLabel} into numbered anchor slots. Automatically padded, centered, and scaled!`
    );
  };

  // Switch to canonical 8-directional compass mode
  const switchToCompassMode = () => {
    setAnchorMode('COMPASS');
    setSlots((prev) => {
      const next = { ...prev };
      (['S', 'W', 'E', 'N', 'SW', 'SE', 'NW', 'NE'] as const).forEach((k) => {
        if (!next[k]) {
          next[k] = { ...INITIAL_SLOTS[k], key: k };
        }
      });
      return next;
    });
    setSlotOrder(['S', 'SW', 'W', 'NW', 'N', 'NE', 'E', 'SE']);
    setActiveDirection('S');
  };

  // Switch to numbered anchor list mode (can extend indefinitely)
  const switchToNumberedMode = () => {
    setAnchorMode('NUMBERED');
    const numberedKeys = Object.keys(slots).filter((k) => k.startsWith('F')).sort();
    if (numberedKeys.length > 0) {
      setSlotOrder(numberedKeys);
      setActiveDirection(numberedKeys[0]);
    } else {
      const newOrder: string[] = [];
      setSlots((prev) => {
        const next = { ...prev };
        const loadedCompass = slotOrder.filter((k) => !!prev[k]?.sourceImage);
        const countToCreate = Math.max(8, loadedCompass.length);
        for (let i = 0; i < countToCreate; i++) {
          const key = `F${String(i + 1).padStart(2, '0')}`;
          newOrder.push(key);
          const sourceSlot = loadedCompass[i] ? prev[loadedCompass[i]] : null;
          if (sourceSlot && !next[key]) {
            next[key] = {
              ...sourceSlot,
              key,
              label: `Frame ${i + 1}`,
              sublabel: sourceSlot.fileName || `Frame ${i + 1}`,
            };
          } else if (!next[key]) {
            next[key] = {
              key,
              label: `Frame ${i + 1}`,
              sublabel: `Slot ${key}`,
              sourceImage: null,
              fileName: null,
              normalizedCanvas: null,
              downscaledCanvas: null,
              bounds: null,
              topHeadroomPx: 0,
            };
          }
        }
        return next;
      });
      setSlotOrder(newOrder);
      setActiveDirection(newOrder[0] || 'F01');
    }
  };

  // Add a new numbered slot to the sequence (indefinite extension)
  const handleAddNumberedSlot = () => {
    const nextIdx = slotOrder.length + 1;
    const newKey = `F${String(nextIdx).padStart(2, '0')}`;
    const newSlot: DirectionSlot = {
      key: newKey,
      label: `Frame ${nextIdx}`,
      sublabel: `Slot ${newKey}`,
      sourceImage: null,
      fileName: null,
      normalizedCanvas: null,
      downscaledCanvas: null,
      bounds: null,
      topHeadroomPx: 0,
    };
    setSlots((prev) => ({ ...prev, [newKey]: newSlot }));
    setSlotOrder((prev) => [...prev, newKey]);
    setActiveDirection(newKey);
  };

  // Delete a numbered slot from the sequence
  const handleDeleteNumberedSlot = (dirKey: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (slotOrder.length <= 1) {
      alert('You must keep at least one anchor slot in the sequence.');
      return;
    }
    const newOrder = slotOrder.filter((k) => k !== dirKey);
    setSlotOrder(newOrder);
    setSlots((prev) => {
      const next = { ...prev };
      delete next[dirKey];
      return next;
    });
    if (activeDirection === dirKey) {
      setActiveDirection(newOrder[0]);
    }
  };

  // Reset back to canonical 8-directional compass slots
  const resetTo8CompassSlots = () => {
    switchToCompassMode();
    setImportBannerMsg(null);
  };

  // Listen for frames transferred from VideoFramePickerPage
  useEffect(() => {
    if (stagedFrames.length > 0) {
      importFramesIntoSlots(stagedFrames, 'Video Frame Picker');
      clearStagedFrames();
    }
  }, [stagedFrames]);

  // Render the current view onto the main preview canvas
  useEffect(() => {
    const canvas = mainPreviewCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;

    const currentSlot = slots[activeDirection];

    if (viewMode === 'RAW') {
      if (currentSlot.sourceImage) {
        canvas.width = currentSlot.sourceImage.width;
        canvas.height = currentSlot.sourceImage.height;
        ctx.drawImage(currentSlot.sourceImage, 0, 0);

        if (showGuides && (currentSlot.rawBounds || currentSlot.bounds)) {
          const b = currentSlot.rawBounds || currentSlot.bounds!;
          ctx.strokeStyle = '#00ffff';
          ctx.lineWidth = 2;
          ctx.strokeRect(b.minX, b.minY, b.width, b.height);
        }
      } else {
        canvas.width = 1024;
        canvas.height = 1024;
        drawEmptyPlaceholder(ctx, canvas.width, canvas.height, 'Upload a sprite to preview');
      }
    } else if (viewMode === 'NORMALIZED_1024') {
      canvas.width = normConfig.targetCanvasSize;
      canvas.height = normConfig.targetCanvasSize;

      if (currentSlot.normalizedCanvas) {
        ctx.drawImage(currentSlot.normalizedCanvas, 0, 0);

        if (showGuides) {
          const toGamePxInCanvas = (pxVal: number) => Math.round((pxVal * normConfig.outputLogicalSize) / normConfig.targetCanvasSize);
          const ceilingY = currentSlot.topHeadroomPx;
          const baselineY = canvas.height * (1 - normConfig.bottomBaselinePercent / 100);
          const bottomMarginPx = Math.round(canvas.height * (normConfig.bottomBaselinePercent / 100));

          // Draw Character Bounds Outline (Cyan dashed)
          if (currentSlot.bounds) {
            ctx.strokeStyle = 'rgba(0, 255, 255, 0.75)';
            ctx.lineWidth = 2;
            ctx.setLineDash([8, 6]);
            ctx.strokeRect(
              currentSlot.bounds.minX,
              currentSlot.bounds.minY,
              currentSlot.bounds.width,
              currentSlot.bounds.height
            );
            ctx.setLineDash([]);
          }

          // Draw Centerline (Subtle blue, bold)
          const centerLineX = (canvas.width * (normConfig.horizontalCenterPercent ?? 50)) / 100;
          ctx.strokeStyle = 'rgba(0, 136, 255, 0.8)';
          ctx.lineWidth = 3;
          ctx.setLineDash([12, 10]);
          ctx.beginPath();
          ctx.moveTo(centerLineX, 0);
          ctx.lineTo(centerLineX, canvas.height);
          ctx.stroke();
          ctx.setLineDash([]);

          // 1. Draw Jump Clearance Ceiling (Green line) - BOLD & HIGH VISIBILITY
          ctx.shadowColor = 'rgba(0, 255, 136, 0.8)';
          ctx.shadowBlur = 8;
          ctx.strokeStyle = '#00ff88';
          ctx.lineWidth = 6;
          ctx.setLineDash([20, 12]);
          ctx.beginPath();
          ctx.moveTo(0, ceilingY);
          ctx.lineTo(canvas.width, ceilingY);
          ctx.stroke();

          // 2. Draw Ground Baseline (Yellow line) - BOLD & HIGH VISIBILITY
          ctx.shadowColor = 'rgba(255, 204, 0, 0.8)';
          ctx.shadowBlur = 8;
          ctx.strokeStyle = '#ffcc00';
          ctx.lineWidth = 6;
          ctx.setLineDash([20, 12]);
          ctx.beginPath();
          ctx.moveTo(0, baselineY);
          ctx.lineTo(canvas.width, baselineY);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.shadowBlur = 0;

          // Badges with bold font and dark contrast pills for crisp readability
          ctx.font = 'bold 22px monospace';

          // Green ceiling text badge (Top Headroom)
          const greenText = `JUMP HEADROOM CEILING (${currentSlot.topHeadroomPx} px / ${toGamePxInCanvas(currentSlot.topHeadroomPx)} game px)`;
          const greenMetrics = ctx.measureText(greenText);
          const greenY = Math.max(34, ceilingY - 14);
          ctx.fillStyle = 'rgba(10, 16, 26, 0.9)';
          ctx.fillRect(12, greenY - 24, greenMetrics.width + 16, 32);
          ctx.strokeStyle = '#00ff88';
          ctx.lineWidth = 2;
          ctx.strokeRect(12, greenY - 24, greenMetrics.width + 16, 32);
          ctx.fillStyle = '#00ff88';
          ctx.fillText(greenText, 20, greenY);

          // Yellow baseline text badge (Bottom Ground Margin matching even padding)
          const yellowText = `FOOT GROUND BASELINE (${bottomMarginPx} px / ${toGamePxInCanvas(bottomMarginPx)} game px • Y = ${Math.round(baselineY)})`;
          const yellowMetrics = ctx.measureText(yellowText);
          const yellowY = Math.min(canvas.height - 18, baselineY + 30);
          ctx.fillStyle = 'rgba(10, 16, 26, 0.9)';
          ctx.fillRect(12, yellowY - 24, yellowMetrics.width + 16, 32);
          ctx.strokeStyle = '#ffcc00';
          ctx.lineWidth = 2;
          ctx.strokeRect(12, yellowY - 24, yellowMetrics.width + 16, 32);
          ctx.fillStyle = '#ffcc00';
          ctx.fillText(yellowText, 20, yellowY);

          // Top right Canvas & Game Frame Size indicator pill
          ctx.textAlign = 'right';
          ctx.font = 'bold 18px monospace';
          const sizeText = `CANVAS: ${canvas.width} px / ${normConfig.outputLogicalSize} game px`;
          const sizeMetrics = ctx.measureText(sizeText);
          ctx.fillStyle = 'rgba(10, 16, 26, 0.9)';
          ctx.fillRect(canvas.width - sizeMetrics.width - 24, 12, sizeMetrics.width + 16, 30);
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
          ctx.lineWidth = 1;
          ctx.strokeRect(canvas.width - sizeMetrics.width - 24, 12, sizeMetrics.width + 16, 30);
          ctx.fillStyle = '#ffffff';
          ctx.fillText(sizeText, canvas.width - 16, 34);
          ctx.textAlign = 'left';
        }
      } else {
        drawEmptyPlaceholder(ctx, canvas.width, canvas.height, 'Awaiting image input...');
      }
    } else if (viewMode === 'DOWNSCALED_256' || viewMode === 'PLAYER') {
      const logSize = normConfig.outputLogicalSize;
      canvas.width = logSize;
      canvas.height = logSize;

      if (currentSlot.downscaledCanvas) {
        ctx.drawImage(currentSlot.downscaledCanvas, 0, 0);
      } else {
        drawEmptyPlaceholder(ctx, canvas.width, canvas.height, 'Awaiting downscaled sprite...');
      }
    }
  }, [viewMode, activeDirection, slots, showGuides, normConfig]);

  // Rotational player preview loop
  useEffect(() => {
    if (viewMode !== 'PLAYER' || !isPlayingRotation) return;

    const availableDirections = slotOrder.filter((d) => !!slots[d]?.sourceImage);
    if (availableDirections.length === 0) return;

    const interval = window.setInterval(() => {
      rotationIndexRef.current = (rotationIndexRef.current + 1) % availableDirections.length;
      setActiveDirection(availableDirections[rotationIndexRef.current]);
    }, 450);

    return () => clearInterval(interval);
  }, [viewMode, isPlayingRotation, slots, slotOrder]);

  const drawEmptyPlaceholder = (ctx: CanvasRenderingContext2D, w: number, h: number, text: string) => {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.fillRect(0, 0, w, h);
    ctx.font = '20px sans-serif';
    ctx.fillStyle = '#8888aa';
    ctx.textAlign = 'center';
    ctx.fillText(text, w / 2, h / 2);
  };

  // Handle uploading files into active or selected direction slot
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const targetDir = targetUploadDirectionRef.current || activeDirection;
    const file = files[0];
    try {
      setIsLoadingImage(true);
      const img = await loadImageFromFile(file);
      const updatedSlot: DirectionSlot = {
        ...slots[targetDir],
        sourceImage: img,
        fileName: file.name,
      };
      const processed = processSlot(updatedSlot);
      setSlots((prev) => ({ ...prev, [targetDir]: processed }));
      setActiveDirection(targetDir);
    } catch (err) {
      console.error('Failed to load image:', err);
    } finally {
      setIsLoadingImage(false);
      targetUploadDirectionRef.current = null;
      e.target.value = '';
    }
  };

  // Drag and drop image handler for main viewport
  const handleDropImage = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!file.type.startsWith('image/')) {
      alert('Please drop a valid image file (PNG, JPG, WebP).');
      return;
    }
    try {
      setIsLoadingImage(true);
      const img = await loadImageFromFile(file);
      const updatedSlot: DirectionSlot = {
        ...slots[activeDirection],
        sourceImage: img,
        fileName: file.name,
      };
      const processed = processSlot(updatedSlot);
      setSlots((prev) => ({ ...prev, [activeDirection]: processed }));
    } catch (err) {
      console.error('Failed to load dropped image:', err);
    } finally {
      setIsLoadingImage(false);
    }
  };



  const calculatedHeight = Math.round((normConfig.targetCanvasSize * normConfig.targetHeightPercent) / 100);
  const calculatedBaseline = Math.round(normConfig.targetCanvasSize * (1 - normConfig.bottomBaselinePercent / 100));
  const calculatedHeadroom = Math.round(calculatedBaseline - calculatedHeight);
  const calculatedBottomMargin = Math.round((normConfig.targetCanvasSize * normConfig.bottomBaselinePercent) / 100);

  const toGamePx = (pxVal: number) => Math.round((pxVal * normConfig.outputLogicalSize) / normConfig.targetCanvasSize);

  // Export handlers
  const handleDownloadActive1024 = () => {
    if (!activeSlot.normalizedCanvas) return;
    downloadCanvasAsPng(activeSlot.normalizedCanvas, `alex_${activeDirection.toLowerCase()}_anchor_1024.png`);
  };

  const handleDownloadActive256 = () => {
    if (!activeSlot.downscaledCanvas) return;
    downloadCanvasAsPng(activeSlot.downscaledCanvas, `alex_${activeDirection.toLowerCase()}_sprite_256.png`);
  };

  const handleDownloadSpriteSheet = () => {
    const loadedSlots = slotOrder
      .filter((k) => !!slots[k]?.downscaledCanvas)
      .map((k) => ({
        name: slots[k].fileName ? slots[k].fileName!.replace(/\.[^/.]+$/, '') : `alex_${k.toLowerCase()}`,
        canvas: slots[k].downscaledCanvas!,
      }));

    if (loadedSlots.length === 0) {
      alert('Please upload and process at least one sprite slot before generating a sprite sheet.');
      return;
    }

    const paddingMetadata: SpriteSheetPaddingConfig = {
      targetCanvasSize: normConfig.targetCanvasSize,
      outputLogicalSize: normConfig.outputLogicalSize,
      targetCharacterHeightPx: calculatedHeight,
      targetCharacterHeightGamePx: toGamePx(calculatedHeight),
      bottomGroundMarginPx: calculatedBottomMargin,
      bottomGroundMarginGamePx: toGamePx(calculatedBottomMargin),
      jumpHeadroomPx: calculatedHeadroom,
      jumpHeadroomGamePx: toGamePx(calculatedHeadroom),
      groundBaselineYPx: calculatedBaseline,
      groundBaselineYGamePx: toGamePx(calculatedBaseline),
      horizontalCenterPercent: normConfig.horizontalCenterPercent,
    };

    const { canvas: sheetCanvas, phaserConfig } = generateSpriteSheet(
      loadedSlots,
      normConfig.outputLogicalSize,
      paddingMetadata
    );
    downloadCanvasAsPng(sheetCanvas, 'alex_directional_spritesheet.png');

    // Also download the JSON config with complete padding metadata
    const blob = new Blob([phaserConfig], { type: 'application/json' });
    const jsonUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = jsonUrl;
    a.download = 'alex_spritesheet_config.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(jsonUrl);
  };

  // Settings export & import handlers
  const handleExportSettings = () => {
    const json = exportSettingsJson();
    const blob = new Blob([json], { type: 'application/json' });
    const jsonUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = jsonUrl;
    a.download = 'sprite_studio_settings.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(jsonUrl);
  };

  const handleImportSettingsFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const ok = importSettingsJson(text);
      if (ok) {
        alert('Settings imported and saved successfully!');
      } else {
        alert('Failed to parse settings JSON file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Background styles
  const getPreviewBgStyle = () => {
    if (previewBg === 'checker') {
      return {
        backgroundImage: `
          linear-gradient(45deg, #181824 25%, transparent 25%), 
          linear-gradient(-45deg, #181824 25%, transparent 25%), 
          linear-gradient(45deg, transparent 75%, #181824 75%), 
          linear-gradient(-45deg, transparent 75%, #181824 75%)
        `,
        backgroundSize: '24px 24px',
        backgroundColor: '#242436',
      };
    }
    if (previewBg === 'dark') return { backgroundColor: '#0f0f18' };
    if (previewBg === 'white') return { backgroundColor: '#ffffff' };
    if (previewBg === 'dungeon') {
      return {
        backgroundImage: 'url(/backgrounds/Dungeon_brick_wall_grey.png)',
        backgroundSize: '128px 128px',
        backgroundRepeat: 'repeat',
      };
    }
    return {};
  };

  return (
    <div
      style={{
        padding: '1.5rem',
        maxWidth: 1400,
        margin: '0 auto',
        color: 'var(--admin-ink, #f0f0ff)',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          paddingBottom: '1.25rem',
          marginBottom: '1.5rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <SparkleIcon size={28} weight="fill" color="#e2b714" />
            <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, letterSpacing: '0.04em', color: '#1b1f23' }}>
              SPRITE STUDIO: ANCHOR NORMALIZER & 4× DOWNSCALER
            </h1>
          </div>
          <p style={{ margin: '0.35rem 0 0 0', color: '#555566', fontSize: '0.9rem' }}>
            Strip chroma backgrounds, enforce consistent character scale & jump headroom, and generate razor-sharp 256×256 in-game pixel art sprites.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => setIsImportModalOpen(true)}
            style={{
              padding: '0.55rem 1rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              fontSize: '0.85rem',
              cursor: 'pointer',
              background: '#242436',
              border: '1px solid rgba(0, 136, 255, 0.45)',
              borderRadius: '6px',
              color: '#33aaff',
              fontWeight: 700,
            }}
            title="Import and split a sprite sheet image into individual anchors"
          >
            <GridIcon size={16} weight="bold" />
            Import Sheet
          </button>
          <SplitButton
            primaryLabel="Apply to All"
            primaryIcon={<SyncIcon size={16} />}
            onPrimaryClick={handleApplyToAll}
            primaryTitle="Apply chroma key & padding settings to all directional slots"
            options={[
              {
                key: 'all-settings',
                label: 'Apply All Settings',
                icon: <SyncIcon size={14} />,
                description: 'Broadcast every parameter from the active frame to all slots',
                onClick: handleApplyToAll,
              },
              {
                key: 'last-change',
                label: 'Apply Last Change',
                icon: <CheckIcon size={14} />,
                description: `Broadcast only the last-changed parameter (${lastChangedParamRef.current ?? 'none'}) to all slots`,
                onClick: handleApplyLastChange,
              },
            ]}
          />
        </div>
      </div>

      {/* Settings Mini Modal */}
      {isSettingsModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setIsSettingsModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#161622',
              border: '1px solid rgba(0, 255, 136, 0.35)',
              boxShadow: '0 16px 48px rgba(0, 0, 0, 0.85)',
              borderRadius: '10px',
              width: 440,
              maxWidth: '92%',
              padding: '1.25rem',
              color: '#fff',
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <GearIcon size={20} color="#00ff88" />
                <span style={{ fontWeight: 700, fontSize: '1rem' }}>Sprite Studio Settings</span>
              </div>
              <button
                type="button"
                onClick={() => setIsSettingsModalOpen(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#888',
                  cursor: 'pointer',
                  padding: 4,
                  display: 'flex',
                }}
              >
                <CloseIcon size={18} />
              </button>
            </div>

            {/* Store Status Card */}
            <div
              style={{
                marginBottom: '1rem',
                padding: '0.75rem',
                background: 'rgba(0, 255, 136, 0.08)',
                borderRadius: 6,
                border: '1px solid rgba(0, 255, 136, 0.25)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.25rem' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#00ff88' }} />
                <span style={{ fontWeight: 700, fontSize: '0.82rem', color: '#00ff88' }}>
                  Persistent Store Active
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#aaa', lineHeight: 1.4 }}>
                All chroma tolerance, edge cleanup, target character height, jump headroom, and centering adjustments are automatically persisted via <code style={{ color: '#00ff88' }}>spriteStudioSettingsStore</code> in LocalStorage.
              </p>
            </div>

            {/* Current Values Summary */}
            <div
              style={{
                marginBottom: '1.25rem',
                padding: '0.75rem',
                background: '#0e0e18',
                borderRadius: 6,
                border: '1px solid rgba(255, 255, 255, 0.1)',
                fontSize: '0.78rem',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '0.4rem',
              }}
            >
              <div><span style={{ color: '#888' }}>Chroma Key:</span> <strong style={{ color: chromaHex }}>{chromaHex}</strong></div>
              <div><span style={{ color: '#888' }}>Tolerance:</span> <strong>{tolerance}</strong></div>
              <div><span style={{ color: '#888' }}>Edge Cleanup:</span> <strong>{cleanUpEdges} px</strong></div>
              <div><span style={{ color: '#888' }}>Edge Feather:</span> <strong>{smoothness} px</strong></div>
              <div><span style={{ color: '#888' }}>Target Height:</span> <strong>{normConfig.targetHeightPercent}%</strong></div>
              <div><span style={{ color: '#888' }}>Ground Margin:</span> <strong>{normConfig.bottomBaselinePercent}%</strong></div>
              <div><span style={{ color: '#888' }}>Center X:</span> <strong>{normConfig.horizontalCenterPercent}%</strong></div>
              <div><span style={{ color: '#888' }}>Logical Frame:</span> <strong>{normConfig.outputLogicalSize} px</strong></div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={handleExportSettings}
                  style={{
                    flex: 1,
                    background: '#242436',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: 6,
                    color: '#fff',
                    padding: '0.5rem',
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 5,
                    fontWeight: 600,
                  }}
                  title="Download settings JSON"
                >
                  <DownloadIcon size={14} color="#00ff88" />
                  Export JSON
                </button>
                <button
                  type="button"
                  onClick={() => settingsFileInputRef.current?.click()}
                  style={{
                    flex: 1,
                    background: '#242436',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: 6,
                    color: '#fff',
                    padding: '0.5rem',
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 5,
                    fontWeight: 600,
                  }}
                  title="Upload settings JSON"
                >
                  <UploadIcon size={14} color="#0088ff" />
                  Import JSON
                </button>
                <input
                  ref={settingsFileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleImportSettingsFile}
                  style={{ display: 'none' }}
                />
              </div>

              <button
                type="button"
                onClick={() => {
                  if (confirm('Reset all Studio settings to canonical defaults?')) {
                    resetToDefaults();
                  }
                }}
                style={{
                  background: 'transparent',
                  border: '1px solid rgba(255, 100, 100, 0.3)',
                  color: '#ff8888',
                  borderRadius: 6,
                  padding: '0.45rem',
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 5,
                  fontWeight: 600,
                }}
              >
                <ResetIcon size={14} />
                Reset to Studio Defaults
              </button>
            </div>

            {/* Footer */}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setIsSettingsModalOpen(false)}
                style={{
                  background: '#00ff88',
                  color: '#000',
                  fontWeight: 700,
                  border: 'none',
                  borderRadius: 6,
                  padding: '0.45rem 1.25rem',
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Directional / Custom Slot Strip with Mode Toggle & Overflow Scroll */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', color: '#e0e0ff', letterSpacing: '0.05em' }}>
              Anchor Mode:
            </span>

            {/* Permanent Toggle between 8-Way Compass and Numbered Anchor Sequence */}
            <div
              style={{
                display: 'inline-flex',
                background: '#0e0e18',
                borderRadius: 7,
                padding: 3,
                border: '1px solid rgba(255, 255, 255, 0.15)',
              }}
            >
              <button
                type="button"
                onClick={switchToCompassMode}
                style={{
                  padding: '5px 12px',
                  borderRadius: 5,
                  background: anchorMode === 'COMPASS' ? '#0088ff' : 'transparent',
                  border: 'none',
                  color: anchorMode === 'COMPASS' ? '#ffffff' : '#8888aa',
                  fontWeight: 700,
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'all 0.15s ease',
                  boxShadow: anchorMode === 'COMPASS' ? '0 2px 8px rgba(0, 136, 255, 0.4)' : 'none',
                }}
                title="Switch to canonical 8-way directional compass anchors (S, SW, W, NW, N, NE, E, SE)"
              >
                <CompassIcon size={14} weight="bold" />
                8-Way Compass
              </button>

              <button
                type="button"
                onClick={switchToNumberedMode}
                style={{
                  padding: '5px 12px',
                  borderRadius: 5,
                  background: anchorMode === 'NUMBERED' ? '#00ff88' : 'transparent',
                  border: 'none',
                  color: anchorMode === 'NUMBERED' ? '#000000' : '#8888aa',
                  fontWeight: 800,
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'all 0.15s ease',
                  boxShadow: anchorMode === 'NUMBERED' ? '0 2px 8px rgba(0, 255, 136, 0.4)' : 'none',
                }}
                title="Switch to numbered anchor list that extends indefinitely with horizontal overflow scrolling"
              >
                <GridIcon size={14} weight="bold" />
                Numbered List ({anchorMode === 'NUMBERED' ? `${slotOrder.length} Slots` : 'Extensible'})
              </button>
            </div>

            {anchorMode === 'NUMBERED' && (
              <span style={{ fontSize: '0.74rem', color: '#00ff88', background: 'rgba(0, 255, 136, 0.1)', padding: '2px 8px', borderRadius: 4, border: '1px solid rgba(0, 255, 136, 0.25)', fontWeight: 600 }}>
                Horizontal Overflow Scroll Active • Indefinite Slots
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '0.78rem', color: '#666688' }}>
              Click slot to edit · Click thumbnail to upload
            </span>
            <button
              type="button"
              onClick={() => setIsSettingsModalOpen(true)}
              style={{
                background: '#242436',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '6px',
                color: '#fff',
                width: 30,
                height: 30,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              title="Studio Settings (Chroma Key & Presets)"
            >
              <GearIcon size={17} color="#00ff88" />
            </button>
          </div>
        </div>

        {/* Slots Container: Flex with overflow-x: auto when NUMBERED; 8-Col Grid when COMPASS */}
        <div
          style={
            anchorMode === 'NUMBERED'
              ? {
                display: 'flex',
                overflowX: 'auto',
                gap: '0.55rem',
                paddingBottom: '0.65rem',
                scrollbarWidth: 'thin',
              }
              : {
                display: 'grid',
                gridTemplateColumns: 'repeat(8, 1fr)',
                gap: '0.5rem',
              }
          }
        >
          {slotOrder.map((dirKey) => {
            const slot = slots[dirKey] || {
              key: dirKey,
              label: dirKey,
              sublabel: '',
              sourceImage: null,
              fileName: null,
              normalizedCanvas: null,
              downscaledCanvas: null,
              bounds: null,
              topHeadroomPx: 0,
            };
            const isSelected = dirKey === activeDirection;
            const hasImage = !!slot.sourceImage;
            const subLabel = slot.sublabel || slot.label.split(' ').slice(1).join(' ') || dirKey;

            return (
              <div
                key={dirKey}
                onClick={() => setActiveDirection(dirKey)}
                style={{
                  position: 'relative',
                  background: isSelected ? 'rgba(0, 136, 255, 0.14)' : '#161622',
                  border: isSelected ? '2px solid #0088ff' : '1px solid rgba(255, 255, 255, 0.09)',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'border-color 0.15s ease, background 0.15s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  height: 100,
                  overflow: 'hidden',
                  userSelect: 'none',
                  ...(anchorMode === 'NUMBERED' ? { flex: '0 0 105px', minWidth: 105 } : {}),
                }}
                title={slot.label}
              >
                {/* Row 1: Direction badge + Delete button (in Numbered mode) */}
                <div
                  style={{
                    height: 22,
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0 6px',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                    background: isSelected ? 'rgba(0,136,255,0.2)' : 'rgba(0,0,0,0.18)',
                  }}
                >
                  <span style={{
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    letterSpacing: '0.04em',
                    color: isSelected ? '#33aaff' : '#8888bb',
                    fontFamily: 'monospace',
                  }}>
                    {dirKey}
                  </span>

                  {anchorMode === 'NUMBERED' && (
                    <button
                      type="button"
                      onClick={(e) => handleDeleteNumberedSlot(dirKey, e)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#666688',
                        cursor: 'pointer',
                        padding: 1,
                        display: 'flex',
                        alignItems: 'center',
                        borderRadius: 2,
                      }}
                      title={`Remove slot ${dirKey}`}
                    >
                      <CloseIcon size={12} />
                    </button>
                  )}
                </div>

                {/* Row 2: Thumbnail area — fixed 54px, click to upload */}
                <div
                  onClick={(e) => { e.stopPropagation(); setActiveDirection(dirKey); (!slot.sourceImage && !isLoadingImage) && triggerUploadForSlot(dirKey); }}
                  style={{
                    height: 54,
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: isSelected ? 'rgba(0,136,255,0.08)' : '#0d0d16',
                    cursor: 'pointer',
                    overflow: 'hidden',
                  }}
                  title={`Upload image for ${slot.label}`}
                >
                  {isLoadingImage && isSelected ? (
                    <SyncIcon size={16} color="#0088ff" className="spin-animation" />
                  ) : slot.downscaledCanvas ? (
                    <img
                      src={slot.downscaledCanvas.toDataURL()}
                      alt={slot.label}
                      style={{ height: '100%', width: '100%', objectFit: 'contain', imageRendering: 'pixelated' }}
                    />
                  ) : slot.sourceImage ? (
                    <img
                      src={slot.sourceImage.src}
                      alt={slot.label}
                      style={{ height: '100%', width: '100%', objectFit: 'contain', opacity: 0.65 }}
                    />
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                      <PlusIcon size={11} weight="bold" color={isSelected ? '#00ff88' : '#555577'} />
                      <span style={{ fontSize: '0.6rem', color: isSelected ? '#00ff88' : '#555577', fontWeight: 700 }}>
                        Add
                      </span>
                    </div>
                  )}
                </div>

                {/* Row 3: Label — fixed 24px */}
                <div
                  style={{
                    height: 24,
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderTop: '1px solid rgba(255,255,255,0.06)',
                    background: 'rgba(0,0,0,0.12)',
                    padding: '0 4px',
                  }}
                >
                  <span style={{
                    fontSize: '0.62rem',
                    color: isSelected ? '#99ccff' : '#666688',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    width: '100%',
                    display: 'block',
                    textAlign: 'center',
                  }}>
                    {subLabel}
                  </span>
                </div>

                {/* Loaded indicator dot */}
                {hasImage && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 5,
                      right: anchorMode === 'NUMBERED' ? 22 : 6,
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: '#00ff88',
                      boxShadow: '0 0 4px rgba(0,255,136,0.7)',
                    }}
                    title="Frame loaded"
                  />
                )}
              </div>
            );
          })}

          {/* + Add Anchor Card for Numbered Mode (Indefinite Extension) */}
          {anchorMode === 'NUMBERED' && (
            <button
              type="button"
              onClick={handleAddNumberedSlot}
              style={{
                flex: '0 0 100px',
                minWidth: 100,
                height: 100,
                borderRadius: 8,
                border: '2px dashed rgba(0, 255, 136, 0.4)',
                background: 'rgba(0, 255, 136, 0.05)',
                color: '#00ff88',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              title="Add another numbered anchor slot to sequence"
            >
              <PlusIcon size={20} weight="bold" />
              <span style={{ fontSize: '0.72rem', fontWeight: 800 }}>+ Add Anchor</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Studio Workspace: 2-Column Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '420px 1fr', gap: '1.5rem', alignItems: 'start' }}>
        {/* Left Column: Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* File Upload Box */}
          <div
            style={{
              background: '#161622',
              borderRadius: '10px',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              padding: '1rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
              <span style={{ fontWeight: 700, fontSize: '0.88rem', color: '#ffffff' }}>
                Slot: {activeSlot.label}
              </span>
              <span style={{ fontSize: '0.72rem', color: '#555577', fontFamily: 'monospace' }}>
                {activeDirection}
              </span>
            </div>

            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />

            {activeSlot.sourceImage ? (
              /* ── Uploaded state ── */
              <div
                style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.7rem',
                  padding: '0.6rem 2rem 0.6rem 0.75rem',
                  background: 'rgba(0, 255, 136, 0.06)',
                  border: '1px solid rgba(0, 255, 136, 0.28)',
                  borderRadius: '8px',
                }}
              >
                {/* Thumbnail */}
                {activeSlot.downscaledCanvas && (
                  <img
                    src={activeSlot.downscaledCanvas.toDataURL()}
                    alt="thumb"
                    style={{
                      width: 44,
                      height: 44,
                      objectFit: 'contain',
                      imageRendering: 'pixelated',
                      background: '#0d0d16',
                      borderRadius: 4,
                      border: '1px solid rgba(0,255,136,0.2)',
                      flexShrink: 0,
                    }}
                  />
                )}

                {/* File info */}
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    color: '#00ff88',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>
                    {activeSlot.fileName}
                  </div>
                  <div style={{ fontSize: '0.68rem', color: '#777799', marginTop: 2 }}>
                    {activeSlot.sourceImage
                      ? `${activeSlot.sourceImage.width} × ${activeSlot.sourceImage.height} px`
                      : ''}
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      marginTop: 4,
                      background: 'transparent',
                      border: 'none',
                      color: '#0088ff',
                      fontSize: '0.7rem',
                      cursor: 'pointer',
                      padding: 0,
                      fontWeight: 600,
                      textDecoration: 'underline',
                    }}
                  >
                    Replace
                  </button>
                </div>

                {/* Red X — clear this slot */}
                <button
                  type="button"
                  onClick={() => clearSlot(activeDirection)}
                  style={{
                    position: 'absolute',
                    top: 6,
                    right: 6,
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    background: 'rgba(255, 60, 60, 0.15)',
                    border: '1px solid rgba(255, 60, 60, 0.5)',
                    color: '#ff4444',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    flexShrink: 0,
                    transition: 'background 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,60,60,0.35)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,60,60,0.15)')}
                  title="Remove this image"
                >
                  <CloseIcon size={12} weight="bold" />
                </button>
              </div>
            ) : (
              /* ── Empty / Upload state ── */
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{
                  width: '100%',
                  padding: '0.7rem',
                  border: '2px dashed rgba(0, 136, 255, 0.35)',
                  borderRadius: '8px',
                  background: 'rgba(0, 136, 255, 0.04)',
                  color: '#fff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                }}
              >
                <UploadIcon size={16} color="#0088ff" />
                Upload Image
              </button>
            )}
          </div>
          <div
            style={{
              background: '#161622',
              borderRadius: '10px',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              padding: '1.25rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <SlidersIcon size={18} color="#e2b714" />
                <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#ffffff' }}>2. Scale, Padding & Jump Headroom</span>
              </div>
              <SplitButton
                size="sm"
                primaryLabel="Apply to All"
                primaryIcon={<SyncIcon size={12} />}
                onPrimaryClick={handleApplyToAll}
                primaryTitle="Broadcast this frame's scale, padding, and chroma settings to all frames"
                accentColor="rgba(0, 136, 255, 0.65)"
                options={[
                  {
                    key: 'all-settings',
                    label: 'Apply All Settings',
                    icon: <SyncIcon size={12} />,
                    description: 'Broadcast every parameter to all slots',
                    onClick: handleApplyToAll,
                  },
                  {
                    key: 'last-change',
                    label: 'Apply Last Change',
                    icon: <CheckIcon size={12} />,
                    description: `Only the last-changed parameter`,
                    onClick: handleApplyLastChange,
                  },
                ]}
              />
            </div>

            {/* Frame specific banner */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '0.8rem',
              padding: '0.35rem 0.6rem',
              background: '#0d0d16',
              borderRadius: 4,
              border: '1px solid rgba(255, 255, 255, 0.06)',
            }}>
              <span style={{ fontSize: '0.75rem', color: '#888' }}>
                Target Frame:
              </span>
              <span style={{ fontSize: '0.78rem', color: '#00ff88', fontWeight: 700 }}>
                {activeSlot.label} ({activeDirection})
              </span>
            </div>

            {/* Auto-Detect Crouch/Bend Scale Control */}
            <div style={{
              marginBottom: '1rem',
              padding: '0.65rem 0.8rem',
              background: 'rgba(0, 136, 255, 0.06)',
              borderRadius: 6,
              border: '1px solid rgba(0, 136, 255, 0.2)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.35rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, color: '#e2e8f0' }}>
                  <input
                    type="checkbox"
                    checked={autoCrouchScale}
                    onChange={(e) => setAutoCrouchScale(e.target.checked)}
                    style={{ cursor: 'pointer', accentColor: '#0088ff' }}
                  />
                  Auto-Detect Crouch/Bend Scale
                </label>
                {calculatedReferenceHeight && (
                  <span style={{ fontSize: '0.7rem', color: '#00ff88', fontFamily: 'monospace' }}>
                    Ref: {calculatedReferenceHeight}px
                  </span>
                )}
              </div>
              <p style={{ margin: 0, fontSize: '0.7rem', color: '#94a3b8', lineHeight: 1.3 }}>
                Averages imported heights to detect bent/crouched frames and scales them proportionally without stretching.
              </p>
              {autoCrouchScale && calculatedReferenceHeight && activeSlot.rawBounds && (activeSlot.rawBounds.height / calculatedReferenceHeight < 0.88) && (
                <div style={{
                  marginTop: 2,
                  padding: '3px 6px',
                  background: 'rgba(234, 179, 8, 0.15)',
                  border: '1px solid rgba(234, 179, 8, 0.4)',
                  borderRadius: 4,
                  fontSize: '0.7rem',
                  color: '#facc15',
                  fontWeight: 600
                }}>
                  🤸 Crouch/Bent Pose: {Math.round((activeSlot.rawBounds.height / calculatedReferenceHeight) * 100)}% of standing height (scale preserved)
                </div>
              )}
            </div>

            <div style={{ marginBottom: '0.9rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '0.3rem' }}>
                <span style={{ color: '#aaa' }}>Character Target Height:</span>
                <span style={{ fontFamily: 'monospace', color: '#e2b714', fontWeight: 700 }}>
                  {calculatedHeight} px / {toGamePx(calculatedHeight)} game px
                </span>
              </div>
              <input
                type="range"
                min={50}
                max={92}
                value={normConfig.targetHeightPercent}
                onChange={(e) => setNormConfig({ targetHeightPercent: Number(e.target.value) })}
                style={{ width: '100%', cursor: 'pointer' }}
              />
            </div>

            <div style={{ marginBottom: '1.2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem', marginBottom: '0.3rem' }}>
                <span style={{ color: '#aaa' }}>Bottom Ground Margin:</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ fontFamily: 'monospace', color: '#e2b714', fontWeight: 700 }}>
                    {calculatedBottomMargin} px / {toGamePx(calculatedBottomMargin)} game px
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (isEvenPaddingLocked) {
                        // Unlock: release the slider for manual editing
                        setIsEvenPaddingLocked(false);
                      } else {
                        // Lock: snap to even value and freeze the slider
                        const evenMargin = Math.round((100 - normConfig.targetHeightPercent) / 2);
                        setNormConfig({ bottomBaselinePercent: evenMargin });
                        setIsEvenPaddingLocked(true);
                      }
                    }}
                    style={{
                      padding: '1px 6px',
                      fontSize: '0.7rem',
                      borderRadius: '3px',
                      background: isEvenPaddingLocked ? '#00ff88' : '#242436',
                      border: `1px solid ${isEvenPaddingLocked ? '#00ff88' : 'rgba(255, 255, 255, 0.2)'}`,
                      color: isEvenPaddingLocked ? '#000' : '#00ff88',
                      cursor: 'pointer',
                      fontWeight: 700,
                    }}
                    title={isEvenPaddingLocked ? 'Click to unlock and adjust manually' : 'Lock to equal empty space on top and bottom'}
                  >
                    {isEvenPaddingLocked ? '⇅ Even (locked)' : 'Even Padding'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEvenPaddingLocked(false);
                      setNormConfig({ bottomBaselinePercent: 8 });
                    }}
                    style={{
                      padding: '1px 6px',
                      fontSize: '0.7rem',
                      borderRadius: '3px',
                      background: !isEvenPaddingLocked && normConfig.bottomBaselinePercent === 8 ? '#e2b714' : '#242436',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      color: !isEvenPaddingLocked && normConfig.bottomBaselinePercent === 8 ? '#000' : '#aaa',
                      cursor: 'pointer',
                      fontWeight: 700,
                    }}
                    title="Grounded foot baseline with jump headroom (8%)"
                  >
                    Grounded (8%)
                  </button>
                </div>
              </div>
              <input
                type="range"
                min={2}
                max={35}
                disabled={isEvenPaddingLocked}
                value={normConfig.bottomBaselinePercent}
                onChange={(e) => setNormConfig({ bottomBaselinePercent: Number(e.target.value) })}
                style={{
                  width: '100%',
                  cursor: isEvenPaddingLocked ? 'not-allowed' : 'pointer',
                  accentColor: isEvenPaddingLocked ? '#444466' : '#e2b714',
                  opacity: isEvenPaddingLocked ? 0.38 : 1,
                  transition: 'opacity 0.2s ease',
                }}
              />
            </div>

            {/* Horizontal Centering Slider (defaults to center 50%) */}
            <div style={{ marginBottom: '1.2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem', marginBottom: '0.3rem' }}>
                <span style={{ color: '#aaa' }}>Horizontal Centering:</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span
                    style={{
                      fontFamily: 'monospace',
                      color: normConfig.horizontalCenterPercent === 50 ? '#00ff88' : '#e2b714',
                      fontWeight: 700,
                    }}
                  >
                    {normConfig.horizontalCenterPercent === 50
                      ? '50% (Center)'
                      : normConfig.horizontalCenterPercent < 50
                        ? `${normConfig.horizontalCenterPercent}% (Left)`
                        : `${normConfig.horizontalCenterPercent}% (Right)`}
                  </span>
                  {normConfig.horizontalCenterPercent !== 50 && (
                    <button
                      type="button"
                      onClick={() => setNormConfig({ horizontalCenterPercent: 50 })}
                      style={{
                        padding: '1px 6px',
                        fontSize: '0.7rem',
                        borderRadius: '3px',
                        background: '#242436',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        color: '#00ff88',
                        cursor: 'pointer',
                        fontWeight: 700,
                      }}
                      title="Reset to 50% Center"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>
              <input
                type="range"
                min={20}
                max={80}
                value={normConfig.horizontalCenterPercent}
                onChange={(e) => setNormConfig({ horizontalCenterPercent: Number(e.target.value) })}
                style={{ width: '100%', cursor: 'pointer', accentColor: '#00ff88' }}
              />
            </div>

            {/* Live Metrics Box */}
            {/* Normalization & Padding Controls */}


            <div
              style={{
                background: '#0d0d16',
                borderRadius: '6px',
                padding: '0.75rem',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                fontSize: '0.8rem',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '0.5rem',
              }}
            >
              <div>
                <span style={{ color: '#888' }}>Jump Headroom:</span>
                <div style={{ color: '#00ff88', fontWeight: 700, fontSize: '0.82rem', fontFamily: 'monospace' }}>
                  {calculatedHeadroom} px / {toGamePx(calculatedHeadroom)} game px
                </div>
              </div>
              <div>
                <span style={{ color: '#888' }}>Ground Baseline:</span>
                <div style={{ color: '#ffcc00', fontWeight: 700, fontSize: '0.82rem', fontFamily: 'monospace' }}>
                  Y = {calculatedBaseline} px / {toGamePx(calculatedBaseline)} game px
                </div>
              </div>
              <div style={{ gridColumn: 'span 2', borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '0.4rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#888' }}>Canvas / Game Size:</span>
                <span style={{ color: '#0088ff', fontWeight: 700, fontSize: '0.82rem', fontFamily: 'monospace' }}>
                  {normConfig.targetCanvasSize} px / {normConfig.outputLogicalSize} game px
                </span>
              </div>
            </div>
          </div>
          {/* Chroma Key Controls */}
          <div
            style={{
              background: '#161622',
              borderRadius: '10px',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              padding: '1.25rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <SlidersIcon size={18} color="#0088ff" />
              <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#ffffff' }}>1. Chroma Key Background Removal</span>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.82rem', color: '#aaa', display: 'block', marginBottom: '0.4rem' }}>
                Chroma Key Color:
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="color"
                  value={chromaHex}
                  onChange={(e) => setChromaHex(e.target.value)}
                  style={{ width: 42, height: 34, border: 'none', borderRadius: 4, cursor: 'pointer', background: 'transparent' }}
                />
                <input
                  type="text"
                  value={chromaHex}
                  onChange={(e) => setChromaHex(e.target.value)}
                  style={{
                    background: '#0e0e18',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: 4,
                    color: '#fff',
                    padding: '0.4rem 0.6rem',
                    fontSize: '0.85rem',
                    fontFamily: 'monospace',
                    width: 90,
                  }}
                />
                {['#FF00FF', '#00FF00', '#000000', '#FFFFFF'].map((swatch) => (
                  <button
                    key={swatch}
                    onClick={() => setChromaHex(swatch)}
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 4,
                      background: swatch,
                      border: chromaHex.toUpperCase() === swatch ? '2px solid #fff' : '1px solid rgba(255, 255, 255, 0.3)',
                      cursor: 'pointer',
                    }}
                    title={swatch}
                  />
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '0.9rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '0.3rem' }}>
                <span style={{ color: '#aaa' }}>Color Distance Tolerance:</span>
                <span style={{ fontFamily: 'monospace', color: '#00ff88' }}>{tolerance}</span>
              </div>
              <input
                type="range"
                min={5}
                max={240}
                value={tolerance}
                onChange={(e) => setTolerance(Number(e.target.value))}
                style={{ width: '100%', cursor: 'pointer' }}
              />
            </div>

            <div style={{ marginBottom: '0.9rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '0.3rem' }}>
                <span style={{ color: '#aaa' }}>Edge Defringe & Feathering:</span>
                <span style={{ fontFamily: 'monospace', color: '#00ff88' }}>{smoothness} px</span>
              </div>
              <input
                type="range"
                min={0}
                max={25}
                value={smoothness}
                onChange={(e) => setSmoothness(Number(e.target.value))}
                style={{ width: '100%', cursor: 'pointer' }}
              />
            </div>

            {/* Clean Up Edges Control (High Visibility Box) */}
            <div
              style={{
                marginTop: '1rem',
                padding: '0.85rem',
                background: 'rgba(0, 255, 136, 0.07)',
                border: '1px solid rgba(0, 255, 136, 0.3)',
                borderRadius: '8px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#ffffff' }}>Clean up edges</span>
                <span
                  style={{
                    fontFamily: 'monospace',
                    color: '#000',
                    background: '#00ff88',
                    fontWeight: 800,
                    fontSize: '0.85rem',
                    padding: '2px 8px',
                    borderRadius: '4px',
                  }}
                >
                  {cleanUpEdges} pixels
                </span>
              </div>
              <p style={{ margin: '0 0 0.6rem 0', fontSize: '0.75rem', color: '#b0b0c8', lineHeight: 1.3 }}>
                (removes fuzzy semi-transparent pixels from the edge after color removal)
              </p>

              <input
                type="range"
                min={0}
                max={6}
                value={cleanUpEdges}
                onChange={(e) => setCleanUpEdges(Number(e.target.value))}
                style={{ width: '100%', cursor: 'pointer', accentColor: '#00ff88', marginBottom: '0.5rem' }}
              />

              {/* Quick Preset Buttons */}
              <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.2rem' }}>
                {[
                  { px: 0, label: '0px' },
                  { px: 1, label: '1px' },
                  { px: 2, label: '2px (Rec)' },
                  { px: 3, label: '3px' },
                  { px: 4, label: '4px' },
                ].map((preset) => (
                  <button
                    key={preset.px}
                    type="button"
                    onClick={() => setCleanUpEdges(preset.px)}
                    style={{
                      flex: 1,
                      padding: '0.3rem 0',
                      borderRadius: '4px',
                      background: cleanUpEdges === preset.px ? '#00ff88' : '#1a1a28',
                      color: cleanUpEdges === preset.px ? '#000' : '#ddd',
                      fontWeight: cleanUpEdges === preset.px ? 800 : 500,
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      fontSize: '0.72rem',
                      cursor: 'pointer',
                    }}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Downscaler Settings */}
          <div
            style={{
              background: '#161622',
              borderRadius: '10px',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              padding: '1.25rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <GridIcon size={18} color="#00ff88" />
              <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#ffffff' }}>3. 4× Pixel-Art Downscaling</span>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.6rem' }}>
              <button
                onClick={() => setNormConfig({ outputLogicalSize: 256 })}
                style={{
                  flex: 1,
                  padding: '0.55rem',
                  borderRadius: '6px',
                  background: normConfig.outputLogicalSize === 256 ? '#0088ff' : '#0d0d16',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                }}
              >
                256 × 256
              </button>
              <button
                onClick={() => setNormConfig({ outputLogicalSize: 128 })}
                style={{
                  flex: 1,
                  padding: '0.55rem',
                  borderRadius: '6px',
                  background: normConfig.outputLogicalSize === 128 ? '#0088ff' : '#0d0d16',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                }}
              >
                128 × 128
              </button>
            </div>
            <p style={{ margin: '0.6rem 0 0 0', fontSize: '0.75rem', color: '#888' }}>
              Resampled using <strong>Nearest-Neighbor algorithm</strong> with zero smoothing, preserving 100% sharp pixel blocks.
            </p>
          </div>
        </div>

        {/* Right Column: Preview & Output */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* View Mode & Background Switcher Bar */}
          <div
            style={{
              background: '#161622',
              borderRadius: '10px',
              padding: '0.6rem 1rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              border: '1px solid rgba(255, 255, 255, 0.12)',
            }}
          >
            {/* View Mode Tabs */}
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              {[
                { id: 'NORMALIZED_1024', label: '1024 Anchor' },
                { id: 'DOWNSCALED_256', label: '256 Sprite' },
                { id: 'PLAYER', label: 'Player Preview' },
                { id: 'RAW', label: 'Raw Input' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setViewMode(tab.id as any)}
                  style={{
                    padding: '0.45rem 0.85rem',
                    borderRadius: '6px',
                    background: viewMode === tab.id ? '#0088ff' : 'transparent',
                    border: 'none',
                    color: viewMode === tab.id ? '#fff' : '#aaa',
                    fontWeight: 600,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Background & Guide Toggles */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', color: '#aaa', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={showGuides}
                  onChange={(e) => setShowGuides(e.target.checked)}
                />
                Show Guides
              </label>

              <div style={{ display: 'flex', gap: '0.25rem', background: '#0d0d16', padding: '2px', borderRadius: 6 }}>
                {(['checker', 'dark', 'dungeon', 'white'] as const).map((bg) => (
                  <button
                    key={bg}
                    onClick={() => setPreviewBg(bg)}
                    style={{
                      padding: '0.25rem 0.5rem',
                      borderRadius: 4,
                      background: previewBg === bg ? '#33334d' : 'transparent',
                      border: 'none',
                      color: '#ddd',
                      fontSize: '0.72rem',
                      cursor: 'pointer',
                      textTransform: 'capitalize',
                    }}
                  >
                    {bg}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Main Canvas Viewport + Vertical Zoom Slider */}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'stretch' }}>

            {/* Canvas Viewport */}
            <div
              style={{
                flex: 1,
                background: '#0d0d16',
                borderRadius: '10px',
                border: isDraggingOver
                  ? '2px dashed #00ff88'
                  : '1px solid rgba(255, 255, 255, 0.12)',
                height: 420,
                minHeight: 400,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                overflow: 'hidden',
                padding: '0.85rem',
                transition: 'border 0.2s ease, background 0.2s ease',
                ...getPreviewBgStyle(),
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDraggingOver(true);
              }}
              onDragLeave={() => setIsDraggingOver(false)}
              onDrop={handleDropImage}
            >
              {isLoadingImage ? (
                /* Dedicated Loading / Processing State */
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '1rem',
                    padding: '2rem',
                    background: 'rgba(16, 22, 34, 0.92)',
                    backdropFilter: 'blur(8px)',
                    borderRadius: '12px',
                    border: '1px solid rgba(0, 136, 255, 0.35)',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
                  }}
                >
                  <SyncIcon size={38} color="#0088ff" className="spin-animation" />
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontWeight: 700, fontSize: '1rem', color: '#fff', marginBottom: 4 }}>
                      Processing Anchor Sprite...
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#8888aa' }}>
                      Removing chroma background, isolating character & generating 4× downscale
                    </div>
                  </div>
                </div>
              ) : !activeSlot.sourceImage ? (
                /* Dedicated "Add Image" Empty Anchor State (opens file import) */
                <div
                  onClick={() => triggerUploadForSlot(activeDirection)}
                  style={{
                    width: '100%',
                    maxWidth: 420,
                    padding: '2rem 1.5rem',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.85rem',
                    border: isDraggingOver
                      ? '2px dashed #00ff88'
                      : '2px dashed rgba(255, 255, 255, 0.22)',
                    background: isDraggingOver
                      ? 'rgba(0, 255, 136, 0.08)'
                      : 'rgba(16, 22, 34, 0.88)',
                    backdropFilter: 'blur(6px)',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: isDraggingOver
                      ? '0 0 24px rgba(0, 255, 136, 0.25)'
                      : '0 8px 32px rgba(0,0,0,0.5)',
                  }}
                  title={`Click or drop image to import for ${activeSlot.label}`}
                >
                  <div
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: '50%',
                      background: 'rgba(0, 136, 255, 0.15)',
                      border: '1px solid rgba(0, 136, 255, 0.35)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <UploadIcon size={26} color="#00ff88" />
                  </div>

                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#ffffff', marginBottom: 4 }}>
                      Add Image for {activeSlot.label}
                    </div>
                    <div style={{ fontSize: '0.82rem', color: '#aaa', maxWidth: 300, lineHeight: 1.4 }}>
                      Drop a 1024×1024 character anchor image here or click below to import
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      triggerUploadForSlot(activeDirection);
                    }}
                    style={{
                      marginTop: '0.35rem',
                      background: '#0088ff',
                      color: '#fff',
                      fontWeight: 700,
                      border: 'none',
                      borderRadius: '6px',
                      padding: '0.55rem 1.3rem',
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      boxShadow: '0 4px 16px rgba(0, 136, 255, 0.4)',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <PlusIcon size={16} weight="bold" />
                    Import Image
                  </button>
                </div>
              ) : (
                <canvas
                  ref={mainPreviewCanvasRef}
                  style={{
                    maxWidth: '100%',
                    maxHeight: 390,
                    boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
                    borderRadius: '4px',
                    imageRendering: 'pixelated',
                    transform: `scale(${zoomLevel})`,
                    transformOrigin: 'center center',
                    transition: 'transform 0.1s ease',
                  }}
                />
              )}

              {/* Interactive Directional Compass Overlay (Only in Player mode) */}
              {viewMode === 'PLAYER' && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: '1.25rem',
                    right: '1.25rem',
                    background: 'rgba(20, 20, 32, 0.92)',
                    backdropFilter: 'blur(8px)',
                    padding: '0.75rem',
                    borderRadius: '10px',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.4rem',
                  }}
                >
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#aaa', marginBottom: 2 }}>
                    TEST ROTATION
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 32px)', gap: 4 }}>
                    <button onClick={() => setActiveDirection('NW')} style={{ height: 32, cursor: 'pointer', background: activeDirection === 'NW' ? '#0088ff' : '#222' }}>NW</button>
                    <button onClick={() => setActiveDirection('N')} style={{ height: 32, cursor: 'pointer', background: activeDirection === 'N' ? '#0088ff' : '#222' }}>N</button>
                    <button onClick={() => setActiveDirection('NE')} style={{ height: 32, cursor: 'pointer', background: activeDirection === 'NE' ? '#0088ff' : '#222' }}>NE</button>
                    <button onClick={() => setActiveDirection('W')} style={{ height: 32, cursor: 'pointer', background: activeDirection === 'W' ? '#0088ff' : '#222' }}>W</button>
                    <button
                      onClick={() => setIsPlayingRotation(!isPlayingRotation)}
                      style={{
                        height: 32,
                        cursor: 'pointer',
                        background: isPlayingRotation ? '#00ff88' : '#e2b714',
                        color: '#000',
                        fontWeight: 800,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      title="Auto Spin"
                    >
                      {isPlayingRotation ? <PauseIcon size={16} weight="bold" /> : <PlayIcon size={16} weight="bold" />}
                    </button>
                    <button onClick={() => setActiveDirection('E')} style={{ height: 32, cursor: 'pointer', background: activeDirection === 'E' ? '#0088ff' : '#222' }}>E</button>
                    <button onClick={() => setActiveDirection('SW')} style={{ height: 32, cursor: 'pointer', background: activeDirection === 'SW' ? '#0088ff' : '#222' }}>SW</button>
                    <button onClick={() => setActiveDirection('S')} style={{ height: 32, cursor: 'pointer', background: activeDirection === 'S' ? '#0088ff' : '#222' }}>S</button>
                    <button onClick={() => setActiveDirection('SE')} style={{ height: 32, cursor: 'pointer', background: activeDirection === 'SE' ? '#0088ff' : '#222' }}>SE</button>
                  </div>
                </div>
              )}
            </div>{/* end Canvas Viewport */}

            {/* Vertical Zoom Slider */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: '#161622',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '10px',
                padding: '0.5rem 0.35rem',
                width: 32,
                height: 420,
                gap: '0.3rem',
              }}
              title={`Zoom: ${Math.round(zoomLevel * 100)}%`}
            >
              <span style={{ fontSize: '0.62rem', color: '#8855ff', fontWeight: 700, letterSpacing: '-0.02em', fontFamily: 'monospace' }}>
                +
              </span>
              <input
                type="range"
                min={50}
                max={300}
                step={5}
                value={Math.round(zoomLevel * 100)}
                onChange={(e) => setZoomLevel(Number(e.target.value) / 100)}
                className="vertical-zoom-slider"
                style={{ flex: 1 }}
                title={`Zoom: ${Math.round(zoomLevel * 100)}%`}
              />
              <span style={{ fontSize: '0.62rem', color: '#553388', fontWeight: 700, fontFamily: 'monospace' }}>
                −
              </span>
              <button
                type="button"
                onClick={() => setZoomLevel(1)}
                style={{
                  background: zoomLevel === 1 ? '#8855ff' : '#242436',
                  border: '1px solid rgba(136, 85, 255, 0.4)',
                  borderRadius: '3px',
                  color: zoomLevel === 1 ? '#fff' : '#8855ff',
                  fontSize: '0.58rem',
                  fontWeight: 700,
                  padding: '2px 3px',
                  cursor: 'pointer',
                  width: '100%',
                  textAlign: 'center',
                  fontFamily: 'monospace',
                }}
                title="Reset zoom to 100%"
              >
                1×
              </button>
            </div>

          </div>{/* end viewport+zoom row */}

          {/* Directional Anchor Scrubber Slider (Simplified Square) */}
          <div
            style={{
              background: '#161622',
              borderRadius: '10px',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              padding: '0.5rem 0.75rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
            }}
          >
            <style>{`
              .square-anchor-slider {
                -webkit-appearance: none;
                appearance: none;
                width: 100%;
                height: 6px;
                background: #242436;
                border-radius: 0px !important;
                outline: none;
                cursor: pointer;
              }
              .square-anchor-slider::-webkit-slider-thumb {
                -webkit-appearance: none;
                appearance: none;
                width: 14px;
                height: 14px;
                background: #0088ff;
                border: 2px solid #ffffff;
                border-radius: 0px !important;
                cursor: pointer;
                transition: transform 0.1s ease;
              }
              .square-anchor-slider::-webkit-slider-thumb:hover {
                transform: scale(1.15);
                background: #33aaff;
              }
              .square-anchor-slider::-moz-range-thumb {
                width: 14px;
                height: 14px;
                background: #0088ff;
                border: 2px solid #ffffff;
                border-radius: 0px !important;
                cursor: pointer;
              }
              .square-anchor-slider::-moz-range-track {
                height: 6px;
                background: #242436;
                border-radius: 0px !important;
              }
              @keyframes studio-spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
              }
              .spin-animation {
                animation: studio-spin 1s linear infinite;
              }
              /* Vertical Zoom Slider */
              .vertical-zoom-slider {
                -webkit-appearance: slider-vertical;
                appearance: none;
                writing-mode: vertical-lr;
                direction: rtl;
                width: 6px;
                height: 100%;
                background: #242436;
                border-radius: 0px !important;
                outline: none;
                cursor: ns-resize;
              }
              .vertical-zoom-slider::-webkit-slider-thumb {
                -webkit-appearance: none;
                appearance: none;
                width: 14px;
                height: 14px;
                background: #8855ff;
                border: 2px solid #ffffff;
                border-radius: 0px !important;
                cursor: ns-resize;
                transition: transform 0.1s ease, background 0.1s ease;
              }
              .vertical-zoom-slider::-webkit-slider-thumb:hover {
                transform: scale(1.15);
                background: #aa88ff;
              }
              .vertical-zoom-slider::-moz-range-thumb {
                width: 14px;
                height: 14px;
                background: #8855ff;
                border: 2px solid #ffffff;
                border-radius: 0px !important;
                cursor: ns-resize;
              }
              .vertical-zoom-slider::-moz-range-track {
                width: 6px;
                background: #242436;
                border-radius: 0px !important;
              }
            `}</style>

            <button
              type="button"
              onClick={() => {
                const currIdx = scrubDirections.indexOf(activeDirection);
                const prevIdx = (currIdx - 1 + scrubDirections.length) % scrubDirections.length;
                setActiveDirection(scrubDirections[prevIdx]);
              }}
              style={{
                background: '#242436',
                border: '1px solid rgba(255, 255, 255, 0.18)',
                borderRadius: '0px',
                color: '#fff',
                width: 28,
                height: 28,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                flexShrink: 0,
              }}
              title="Previous Loaded Anchor"
            >
              <CaretLeftIcon size={14} weight="bold" />
            </button>

            <input
              type="range"
              min={0}
              max={Math.max(0, scrubDirections.length - 1)}
              step={1}
              value={Math.max(0, scrubDirections.indexOf(activeDirection))}
              disabled={scrubDirections.length <= 1}
              onChange={(e) => {
                const idx = Number(e.target.value);
                if (scrubDirections[idx]) {
                  setActiveDirection(scrubDirections[idx]);
                }
              }}
              className="square-anchor-slider"
              title={`Anchor: ${activeDirection} (${Math.max(0, scrubDirections.indexOf(activeDirection)) + 1} / ${scrubDirections.length})`}
            />

            <button
              type="button"
              onClick={() => {
                const currIdx = scrubDirections.indexOf(activeDirection);
                const nextIdx = (currIdx + 1) % scrubDirections.length;
                setActiveDirection(scrubDirections[nextIdx]);
              }}
              style={{
                background: '#242436',
                border: '1px solid rgba(255, 255, 255, 0.18)',
                borderRadius: '0px',
                color: '#fff',
                width: 28,
                height: 28,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                flexShrink: 0,
              }}
              title="Next Loaded Anchor"
            >
              <CaretRightIcon size={14} weight="bold" />
            </button>
          </div>

          {/* Export Action Bar */}
          <div
            style={{
              background: '#161622',
              borderRadius: '10px',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              padding: '0.9rem 1.25rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '1rem',
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>Game Ready Exports</div>
              <div style={{ fontSize: '0.75rem', color: '#8888aa', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                Download individual PNGs or compiled sprite sheet
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
              <button
                onClick={handleDownloadActive1024}
                disabled={!activeSlot.normalizedCanvas}
                className="admin-btn admin-btn-secondary"
                style={{
                  padding: '0.5rem 0.85rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  fontSize: '0.82rem',
                  cursor: activeSlot.normalizedCanvas ? 'pointer' : 'not-allowed',
                  opacity: activeSlot.normalizedCanvas ? 1 : 0.5,
                  background: '#242436',
                  color: '#fff',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: 6,
                  fontWeight: 600,
                }}
                title={`Download 1024 Anchor PNG (${activeDirection})`}
              >
                <DownloadIcon size={16} />
                1024 Anchor
              </button>

              <button
                onClick={handleDownloadActive256}
                disabled={!activeSlot.downscaledCanvas}
                className="admin-btn admin-btn-secondary"
                style={{
                  padding: '0.5rem 0.85rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  fontSize: '0.82rem',
                  cursor: activeSlot.downscaledCanvas ? 'pointer' : 'not-allowed',
                  opacity: activeSlot.downscaledCanvas ? 1 : 0.5,
                  background: '#242436',
                  color: '#fff',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: 6,
                  fontWeight: 600,
                }}
                title={`Download 256 In-Game Sprite PNG (${activeDirection})`}
              >
                <DownloadIcon size={16} />
                256 Sprite
              </button>

              <button
                onClick={handleDownloadSpriteSheet}
                className="admin-btn admin-btn-primary"
                style={{
                  padding: '0.5rem 1rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  background: '#00ff88',
                  color: '#000',
                  fontWeight: 700,
                  border: 'none',
                  borderRadius: 6,
                }}
                title="Export compiled Phaser 3 sprite sheet PNG & config JSON"
              >
                <DownloadIcon size={16} weight="bold" />
                Export Sheet
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Sprite Sheet Splitter & Importer Modal */}
      <SpriteSheetImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImport={(results) => importFramesIntoSlots(results, 'Sprite Sheet Slicer')}
      />
    </div>
  );
};
