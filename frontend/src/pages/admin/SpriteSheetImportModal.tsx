import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  X as CloseIcon,
  UploadSimple as UploadIcon,
  SquaresFour as GridIcon,
  Check as CheckIcon,
  CaretLeft as PrevIcon,
  CaretRight as NextIcon,
  Trash as TrashIcon,
  Plus as PlusIcon,
  Minus as MinusIcon,
  ArrowCounterClockwise as ResetIcon,
} from '@phosphor-icons/react';
import {
  detectSpriteSheetFrames,
  buildUniformGrid,
  DetectedFrame,
  TileAlignment,
} from '../../lib/sprites/spriteProcessor';

export interface SlicedFrameResult {
  name: string;
  canvas: HTMLCanvasElement;
}

interface SpriteSheetImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (frames: SlicedFrameResult[]) => void;
}

// Custom SVG Icons matching user's Tile Alignment specifications
const HorizontalStripIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
    <rect x="1.5" y="2" width="17" height="16" rx="2" fill="#dbeafe" stroke="#60a5fa" strokeWidth="1.2" />
    <line x1="7.5" y1="2" x2="7.5" y2="18" stroke="#1e293b" strokeWidth="1.5" />
    <line x1="12.5" y1="2" x2="12.5" y2="18" stroke="#1e293b" strokeWidth="1.5" />
  </svg>
);

const VerticalStripIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
    <rect x="1.5" y="2" width="17" height="16" rx="2" fill="#dbeafe" stroke="#60a5fa" strokeWidth="1.2" />
    <line x1="1.5" y1="7.5" x2="18.5" y2="7.5" stroke="#1e293b" strokeWidth="1.5" />
    <line x1="1.5" y1="12.5" x2="18.5" y2="12.5" stroke="#1e293b" strokeWidth="1.5" />
  </svg>
);

const CustomGridIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
    <rect x="1.5" y="2" width="17" height="16" rx="2" fill="#dbeafe" stroke="#60a5fa" strokeWidth="1.2" />
    <line x1="7.5" y1="2" x2="7.5" y2="18" stroke="#1e293b" strokeWidth="1.2" />
    <line x1="12.5" y1="2" x2="12.5" y2="18" stroke="#1e293b" strokeWidth="1.2" />
    <line x1="1.5" y1="7.5" x2="18.5" y2="7.5" stroke="#1e293b" strokeWidth="1.2" />
    <line x1="1.5" y1="12.5" x2="18.5" y2="12.5" stroke="#1e293b" strokeWidth="1.2" />
  </svg>
);

export const SpriteSheetImportModal: React.FC<SpriteSheetImportModalProps> = ({
  isOpen,
  onClose,
  onImport,
}) => {
  const [sheetImage, setSheetImage] = useState<HTMLImageElement | null>(null);
  const [sheetFileName, setSheetFileName] = useState<string>('');
  const [detectedFrames, setDetectedFrames] = useState<DetectedFrame[]>([]);
  const [selectedFrameIndex, setSelectedFrameIndex] = useState<number>(0);

  // 3 Types of Sprite Sheet Tile Alignments
  const [tileAlignment, setTileAlignment] = useState<TileAlignment>('HORIZONTAL');

  // Alignment configuration values
  const [horizontalCols, setHorizontalCols] = useState<number>(8);
  const [verticalRows, setVerticalRows] = useState<number>(4);
  const [gridCols, setGridCols] = useState<number>(8);
  const [gridRows, setGridRows] = useState<number>(4);

  // Optional frame count limit (useful when last row has empty tiles)
  const [maxFramesLimit, setMaxFramesLimit] = useState<number | null>(null);

  // Slicing Mode: Uniform exact grid vs auto-content gap detection
  const [slicingStrategy, setSlicingStrategy] = useState<'UNIFORM' | 'AUTO_DETECT'>('UNIFORM');

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Automatically analyze image dimensions on load to pick the best default alignment
  const handleImageLoaded = (img: HTMLImageElement, name: string) => {
    setSheetImage(img);
    setSheetFileName(name);

    const { width, height } = img;
    let initialAlignment: TileAlignment = 'HORIZONTAL';
    let hCols = 8;
    let vRows = 4;
    let gCols = 4;
    let gRows = 4;

    if (width >= height * 1.6) {
      // Horizontal strip (e.g. 5888x256 -> 23 frames, 2048x256 -> 8 frames)
      initialAlignment = 'HORIZONTAL';
      hCols = Math.max(1, Math.round(width / height));
      setHorizontalCols(hCols);
    } else if (height >= width * 1.6) {
      // Vertical strip (e.g. 256x2048 -> 8 frames)
      initialAlignment = 'VERTICAL';
      vRows = Math.max(1, Math.round(height / width));
      setVerticalRows(vRows);
    } else {
      // Custom 2D grid (e.g. 1024x1024, 2048x1024)
      initialAlignment = 'CUSTOM_GRID';
      for (const tileSize of [256, 128, 64, 512, 32]) {
        if (width % tileSize === 0 && height % tileSize === 0) {
          gCols = Math.max(1, width / tileSize);
          gRows = Math.max(1, height / tileSize);
          break;
        }
      }
      setGridCols(gCols);
      setGridRows(gRows);
    }

    setTileAlignment(initialAlignment);
    setMaxFramesLimit(null);
    recalculateFrames(img, initialAlignment, hCols, vRows, gCols, gRows, null, 'UNIFORM');
  };

  // Re-slices frames based on current alignment and parameters
  const recalculateFrames = (
    img: HTMLImageElement | null = sheetImage,
    alignment: TileAlignment = tileAlignment,
    hCols: number = horizontalCols,
    vRows: number = verticalRows,
    gCols: number = gridCols,
    gRows: number = gridRows,
    limit: number | null = maxFramesLimit,
    strategy: 'UNIFORM' | 'AUTO_DETECT' = slicingStrategy
  ) => {
    if (!img) {
      setDetectedFrames([]);
      return;
    }

    let cols = 1;
    let rows = 1;

    if (alignment === 'HORIZONTAL') {
      cols = Math.max(1, hCols);
      rows = 1;
    } else if (alignment === 'VERTICAL') {
      cols = 1;
      rows = Math.max(1, vRows);
    } else {
      cols = Math.max(1, gCols);
      rows = Math.max(1, gRows);
    }

    if (strategy === 'AUTO_DETECT') {
      const detected = detectSpriteSheetFrames(img, {
        alignment,
        cols,
        rows,
        limit: limit ?? undefined,
      });
      setDetectedFrames(detected);
    } else {
      const uniform = buildUniformGrid(img.width, img.height, cols, rows, limit ?? undefined);
      setDetectedFrames(uniform);
    }
    setSelectedFrameIndex(0);
  };

  // Trigger recalculation whenever configuration changes
  useEffect(() => {
    if (!sheetImage) return;
    recalculateFrames(
      sheetImage,
      tileAlignment,
      horizontalCols,
      verticalRows,
      gridCols,
      gridRows,
      maxFramesLimit,
      slicingStrategy
    );
  }, [
    tileAlignment,
    horizontalCols,
    verticalRows,
    gridCols,
    gridRows,
    maxFramesLimit,
    slicingStrategy,
  ]);

  // Render canvas with interactive frame bounding box overlays
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !sheetImage) return;

    canvas.width = sheetImage.width;
    canvas.height = sheetImage.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(sheetImage, 0, 0);

    // Draw detected frame cut boxes
    detectedFrames.forEach((frame, idx) => {
      const isSelected = idx === selectedFrameIndex;

      // Highlight selected frame in bright cyan-green
      ctx.strokeStyle = isSelected ? '#00ff88' : 'rgba(0, 136, 255, 0.75)';
      ctx.lineWidth = isSelected ? 3 : 1.5;
      ctx.strokeRect(frame.x, frame.y, frame.w, frame.h);

      if (isSelected) {
        ctx.fillStyle = 'rgba(0, 255, 136, 0.15)';
        ctx.fillRect(frame.x, frame.y, frame.w, frame.h);
      }

      // Box index label badge
      const badgeW = Math.min(frame.w, 32);
      const badgeH = Math.min(frame.h, 18);
      ctx.fillStyle = isSelected ? 'rgba(0, 255, 136, 0.9)' : 'rgba(10, 16, 26, 0.85)';
      ctx.fillRect(frame.x, frame.y, badgeW, badgeH);
      ctx.strokeStyle = isSelected ? '#00ff88' : 'rgba(0, 136, 255, 0.8)';
      ctx.lineWidth = 1;
      ctx.strokeRect(frame.x, frame.y, badgeW, badgeH);

      ctx.fillStyle = isSelected ? '#000' : '#00a2ff';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(idx + 1), frame.x + badgeW / 2, frame.y + badgeH / 2);
    });
  }, [sheetImage, detectedFrames, selectedFrameIndex]);

  // Handle clicking on canvas to select frame
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !sheetImage || detectedFrames.length === 0) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;

    // Find clicked frame
    const foundIdx = detectedFrames.findIndex(
      (f) => clickX >= f.x && clickX <= f.x + f.w && clickY >= f.y && clickY <= f.y + f.h
    );

    if (foundIdx !== -1) {
      setSelectedFrameIndex(foundIdx);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    loadSheetFile(file);
    e.target.value = '';
  };

  const loadSheetFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        handleImageLoaded(img, file.name);
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      loadSheetFile(file);
    }
  };

  // Crop adjustment for currently selected frame
  const updateCurrentFrameCrop = (field: 'x' | 'y' | 'w' | 'h', value: number) => {
    setDetectedFrames((prev) => {
      const next = [...prev];
      if (!next[selectedFrameIndex]) return prev;
      next[selectedFrameIndex] = {
        ...next[selectedFrameIndex],
        [field]: Math.max(1, value),
      };
      return next;
    });
  };

  // Delete an unwanted individual frame from the import list
  const handleDeleteFrame = (indexToDelete: number) => {
    setDetectedFrames((prev) => {
      const next = prev.filter((_, idx) => idx !== indexToDelete);
      return next.map((f, i) => ({ ...f, index: i }));
    });
    if (selectedFrameIndex >= indexToDelete && selectedFrameIndex > 0) {
      setSelectedFrameIndex((i) => i - 1);
    }
  };

  // Slice each frame out as an HTMLCanvasElement and confirm
  const handleConfirmImport = () => {
    if (!sheetImage || detectedFrames.length === 0) return;

    const baseName = sheetFileName.replace(/\.[^/.]+$/, '') || 'frame';
    const results: SlicedFrameResult[] = detectedFrames.map((f, i) => {
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(f.w));
      c.height = Math.max(1, Math.round(f.h));
      const ctx = c.getContext('2d');
      if (ctx) {
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(
          sheetImage,
          f.x,
          f.y,
          f.w,
          f.h,
          0,
          0,
          c.width,
          c.height
        );
      }
      return {
        name: `${baseName}_frame_${String(i + 1).padStart(2, '0')}`,
        canvas: c,
      };
    });

    onImport(results);
    onClose();
  };

  const activeFrame = detectedFrames[selectedFrameIndex];

  // Tile dimensions calculation for display
  const currentTileDimensions = useMemo(() => {
    if (!sheetImage) return { w: 0, h: 0, total: 0 };
    const { width, height } = sheetImage;
    if (tileAlignment === 'HORIZONTAL') {
      const cols = Math.max(1, horizontalCols);
      return { w: Math.floor(width / cols), h: height, total: cols };
    } else if (tileAlignment === 'VERTICAL') {
      const rows = Math.max(1, verticalRows);
      return { w: width, h: Math.floor(height / rows), total: rows };
    } else {
      const cols = Math.max(1, gridCols);
      const rows = Math.max(1, gridRows);
      return { w: Math.floor(width / cols), h: Math.floor(height / rows), total: cols * rows };
    }
  }, [sheetImage, tileAlignment, horizontalCols, verticalRows, gridCols, gridRows]);

  const loadSampleImage = (url: string, name: string) => {
    const img = new Image();
    img.onload = () => {
      handleImageLoaded(img, name);
    };
    img.src = url;
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(6px)',
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.25rem',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#141721',
          border: '1px solid rgba(0, 136, 255, 0.35)',
          borderRadius: 12,
          width: 1140,
          maxWidth: '96vw',
          maxHeight: '94vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 70px rgba(0, 0, 0, 0.9)',
          color: '#fff',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '1rem 1.25rem',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: '#0f1118',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <GridIcon size={24} color="#0088ff" weight="bold" />
            <div>
              <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, letterSpacing: '-0.01em' }}>
                Import Sprite Sheet: Split & Anchor Slicer
              </h2>
              <p style={{ margin: 0, fontSize: '0.78rem', color: '#8888aa' }}>
                Select tile alignment (horizontal strip, vertical strip, or custom grid) to slice frames into custom anchor slots
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#888',
              cursor: 'pointer',
              padding: 6,
              borderRadius: 4,
            }}
          >
            <CloseIcon size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}
        >
          {/* TILE ALIGNMENT CONFIGURATION (Visible Always at Top) */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '220px 1fr',
              gap: '1rem',
              padding: '0.9rem 1.1rem',
              background: '#0d0f17',
              borderRadius: 8,
              border: '1px solid rgba(0, 136, 255, 0.25)',
            }}
          >
            {/* 1. Tile alignment selector list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div
                style={{
                  fontSize: '0.92rem',
                  fontWeight: 700,
                  color: '#00a2ff',
                  letterSpacing: '0.01em',
                  marginBottom: '0.15rem',
                }}
              >
                Tile alignment:
              </div>

              {/* Option 1: Stack horizontally */}
              <div
                onClick={() => setTileAlignment('HORIZONTAL')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                  cursor: 'pointer',
                  userSelect: 'none',
                  padding: '5px 8px',
                  borderRadius: 6,
                  background: tileAlignment === 'HORIZONTAL' ? 'rgba(0, 136, 255, 0.18)' : 'transparent',
                  border: tileAlignment === 'HORIZONTAL' ? '1px solid rgba(0, 136, 255, 0.4)' : '1px solid transparent',
                  transition: 'all 0.15s ease',
                }}
              >
                <div
                  style={{
                    width: 17,
                    height: 17,
                    borderRadius: 3,
                    border: tileAlignment === 'HORIZONTAL' ? '1px solid #0088ff' : '1px solid #64748b',
                    backgroundColor: tileAlignment === 'HORIZONTAL' ? '#0078d4' : '#141721',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {tileAlignment === 'HORIZONTAL' && (
                    <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
                      <path d="M1 4.5L4 7.5L10 1.5" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
                <HorizontalStripIcon size={18} />
                <span style={{ fontSize: '0.85rem', fontWeight: tileAlignment === 'HORIZONTAL' ? 700 : 400, color: tileAlignment === 'HORIZONTAL' ? '#fff' : '#cbd5e1' }}>
                  Stack horizontally
                </span>
              </div>

              {/* Option 2: Stack vertically */}
              <div
                onClick={() => setTileAlignment('VERTICAL')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                  cursor: 'pointer',
                  userSelect: 'none',
                  padding: '5px 8px',
                  borderRadius: 6,
                  background: tileAlignment === 'VERTICAL' ? 'rgba(0, 136, 255, 0.18)' : 'transparent',
                  border: tileAlignment === 'VERTICAL' ? '1px solid rgba(0, 136, 255, 0.4)' : '1px solid transparent',
                  transition: 'all 0.15s ease',
                }}
              >
                <div
                  style={{
                    width: 17,
                    height: 17,
                    borderRadius: 3,
                    border: tileAlignment === 'VERTICAL' ? '1px solid #0088ff' : '1px solid #64748b',
                    backgroundColor: tileAlignment === 'VERTICAL' ? '#0078d4' : '#141721',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {tileAlignment === 'VERTICAL' && (
                    <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
                      <path d="M1 4.5L4 7.5L10 1.5" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
                <VerticalStripIcon size={18} />
                <span style={{ fontSize: '0.85rem', fontWeight: tileAlignment === 'VERTICAL' ? 700 : 400, color: tileAlignment === 'VERTICAL' ? '#fff' : '#cbd5e1' }}>
                  Stack vertically
                </span>
              </div>

              {/* Option 3: Custom grid */}
              <div
                onClick={() => setTileAlignment('CUSTOM_GRID')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                  cursor: 'pointer',
                  userSelect: 'none',
                  padding: '5px 8px',
                  borderRadius: 6,
                  background: tileAlignment === 'CUSTOM_GRID' ? 'rgba(0, 136, 255, 0.18)' : 'transparent',
                  border: tileAlignment === 'CUSTOM_GRID' ? '1px solid rgba(0, 136, 255, 0.4)' : '1px solid transparent',
                  transition: 'all 0.15s ease',
                }}
              >
                <div
                  style={{
                    width: 17,
                    height: 17,
                    borderRadius: 3,
                    border: tileAlignment === 'CUSTOM_GRID' ? '1px solid #0088ff' : '1px solid #64748b',
                    backgroundColor: tileAlignment === 'CUSTOM_GRID' ? '#0078d4' : '#141721',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {tileAlignment === 'CUSTOM_GRID' && (
                    <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
                      <path d="M1 4.5L4 7.5L10 1.5" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
                <CustomGridIcon size={18} />
                <span style={{ fontSize: '0.85rem', fontWeight: tileAlignment === 'CUSTOM_GRID' ? 700 : 400, color: tileAlignment === 'CUSTOM_GRID' ? '#fff' : '#cbd5e1' }}>
                  Custom grid
                </span>
              </div>
            </div>

            {/* 2. Alignment Parameters & Live Dimensions */}
            <div
              style={{
                backgroundColor: '#141824',
                borderRadius: 6,
                padding: '0.85rem 1.1rem',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                gap: '0.75rem',
              }}
            >
              {/* Parameter Controls for Stack Horizontally */}
              {tileAlignment === 'HORIZONTAL' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#ddd' }}>
                        Columns (Frame Count):
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <button
                          onClick={() => setHorizontalCols((c) => Math.max(1, c - 1))}
                          style={{ width: 26, height: 26, background: '#202538', border: '1px solid #444', color: '#fff', borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <MinusIcon size={12} />
                        </button>
                        <input
                          type="number"
                          min={1}
                          max={128}
                          value={horizontalCols}
                          onChange={(e) => setHorizontalCols(Math.max(1, Number(e.target.value)))}
                          style={{ width: 56, textAlign: 'center', padding: '3px 6px', background: '#0a0c12', border: '1px solid #0088ff', color: '#fff', borderRadius: 4, fontWeight: 700, fontSize: '0.9rem' }}
                        />
                        <button
                          onClick={() => setHorizontalCols((c) => c + 1)}
                          style={{ width: 26, height: 26, background: '#202538', border: '1px solid #444', color: '#fff', borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <PlusIcon size={12} />
                        </button>
                      </div>
                    </div>

                    {/* Calculated Tile Size Badge */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.75rem', color: '#888' }}>Each Tile Size:</span>
                      <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#00ff88', background: 'rgba(0, 255, 136, 0.1)', padding: '2px 8px', borderRadius: 4, border: '1px solid rgba(0, 255, 136, 0.3)' }}>
                        {currentTileDimensions.w > 0 ? `${currentTileDimensions.w} × ${currentTileDimensions.h} px` : 'Awaiting image'}
                      </span>
                    </div>
                  </div>

                  {/* Quick Presets */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.72rem', color: '#888' }}>Quick Presets:</span>
                    {[4, 8, 12, 16, 23, 24].map((preset) => (
                      <button
                        key={preset}
                        onClick={() => setHorizontalCols(preset)}
                        style={{
                          padding: '2px 8px',
                          fontSize: '0.72rem',
                          borderRadius: 4,
                          background: horizontalCols === preset ? '#0088ff' : '#1e2436',
                          color: horizontalCols === preset ? '#fff' : '#cbd5e1',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          cursor: 'pointer',
                        }}
                      >
                        {preset} frames
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Parameter Controls for Stack Vertically */}
              {tileAlignment === 'VERTICAL' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#ddd' }}>
                        Rows (Frame Count):
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <button
                          onClick={() => setVerticalRows((r) => Math.max(1, r - 1))}
                          style={{ width: 26, height: 26, background: '#202538', border: '1px solid #444', color: '#fff', borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <MinusIcon size={12} />
                        </button>
                        <input
                          type="number"
                          min={1}
                          max={128}
                          value={verticalRows}
                          onChange={(e) => setVerticalRows(Math.max(1, Number(e.target.value)))}
                          style={{ width: 56, textAlign: 'center', padding: '3px 6px', background: '#0a0c12', border: '1px solid #0088ff', color: '#fff', borderRadius: 4, fontWeight: 700, fontSize: '0.9rem' }}
                        />
                        <button
                          onClick={() => setVerticalRows((r) => r + 1)}
                          style={{ width: 26, height: 26, background: '#202538', border: '1px solid #444', color: '#fff', borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <PlusIcon size={12} />
                        </button>
                      </div>
                    </div>

                    {/* Calculated Tile Size Badge */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.75rem', color: '#888' }}>Each Tile Size:</span>
                      <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#00ff88', background: 'rgba(0, 255, 136, 0.1)', padding: '2px 8px', borderRadius: 4, border: '1px solid rgba(0, 255, 136, 0.3)' }}>
                        {currentTileDimensions.w > 0 ? `${currentTileDimensions.w} × ${currentTileDimensions.h} px` : 'Awaiting image'}
                      </span>
                    </div>
                  </div>

                  {/* Quick Presets */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.72rem', color: '#888' }}>Quick Presets:</span>
                    {[4, 8, 12, 16].map((preset) => (
                      <button
                        key={preset}
                        onClick={() => setVerticalRows(preset)}
                        style={{
                          padding: '2px 8px',
                          fontSize: '0.72rem',
                          borderRadius: 4,
                          background: verticalRows === preset ? '#0088ff' : '#1e2436',
                          color: verticalRows === preset ? '#fff' : '#cbd5e1',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          cursor: 'pointer',
                        }}
                      >
                        {preset} frames
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Parameter Controls for Custom Grid */}
              {tileAlignment === 'CUSTOM_GRID' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                    {/* Cols and Rows */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#ddd' }}>Cols (X):</span>
                        <input
                          type="number"
                          min={1}
                          max={64}
                          value={gridCols}
                          onChange={(e) => setGridCols(Math.max(1, Number(e.target.value)))}
                          style={{ width: 48, textAlign: 'center', padding: '3px 6px', background: '#0a0c12', border: '1px solid #0088ff', color: '#fff', borderRadius: 4, fontWeight: 700 }}
                        />
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#ddd' }}>Rows (Y):</span>
                        <input
                          type="number"
                          min={1}
                          max={64}
                          value={gridRows}
                          onChange={(e) => setGridRows(Math.max(1, Number(e.target.value)))}
                          style={{ width: 48, textAlign: 'center', padding: '3px 6px', background: '#0a0c12', border: '1px solid #0088ff', color: '#fff', borderRadius: 4, fontWeight: 700 }}
                        />
                      </div>

                      {/* Dual inputs: Set by Tile Width / Height */}
                      {sheetImage && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', borderLeft: '1px solid #333', paddingLeft: '0.8rem' }}>
                          <span style={{ fontSize: '0.75rem', color: '#888' }}>Tile W×H:</span>
                          <input
                            type="number"
                            placeholder="W"
                            value={currentTileDimensions.w}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              if (val > 0) setGridCols(Math.max(1, Math.floor(sheetImage.width / val)));
                            }}
                            style={{ width: 48, textAlign: 'center', padding: '2px 4px', background: '#0a0c12', border: '1px solid #444', color: '#fff', borderRadius: 4, fontSize: '0.75rem' }}
                          />
                          <span style={{ color: '#666' }}>×</span>
                          <input
                            type="number"
                            placeholder="H"
                            value={currentTileDimensions.h}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              if (val > 0) setGridRows(Math.max(1, Math.floor(sheetImage.height / val)));
                            }}
                            style={{ width: 48, textAlign: 'center', padding: '2px 4px', background: '#0a0c12', border: '1px solid #444', color: '#fff', borderRadius: 4, fontSize: '0.75rem' }}
                          />
                        </div>
                      )}
                    </div>

                    {/* Total Grid Tiles Badge */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.75rem', color: '#888' }}>Grid Layout:</span>
                      <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#00ff88', background: 'rgba(0, 255, 136, 0.1)', padding: '2px 8px', borderRadius: 4, border: '1px solid rgba(0, 255, 136, 0.3)' }}>
                        {currentTileDimensions.w > 0 ? `${currentTileDimensions.w} × ${currentTileDimensions.h} px (${gridCols * gridRows} tiles)` : `${gridCols} cols × ${gridRows} rows`}
                      </span>
                    </div>
                  </div>

                  {/* Optional Limit and Presets */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <label style={{ fontSize: '0.75rem', color: '#888' }}>
                        Limit Import To:
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={gridCols * gridRows}
                        placeholder={`All (${gridCols * gridRows})`}
                        value={maxFramesLimit ?? ''}
                        onChange={(e) => setMaxFramesLimit(e.target.value ? Math.max(1, Number(e.target.value)) : null)}
                        style={{ width: 68, padding: '2px 6px', background: '#0a0c12', border: '1px solid #444', color: '#fff', borderRadius: 4, fontSize: '0.75rem' }}
                      />
                      <span style={{ fontSize: '0.7rem', color: '#666' }}>frames (skips empty trailing tiles)</span>
                    </div>

                    {/* Standard grid presets */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <span style={{ fontSize: '0.7rem', color: '#888' }}>Grids:</span>
                      {[
                        { c: 8, r: 1, label: '8x1' },
                        { c: 4, r: 2, label: '4x2' },
                        { c: 4, r: 4, label: '4x4' },
                        { c: 8, r: 4, label: '8x4' },
                      ].map((p) => (
                        <button
                          key={p.label}
                          onClick={() => {
                            setGridCols(p.c);
                            setGridRows(p.r);
                          }}
                          style={{
                            padding: '2px 6px',
                            fontSize: '0.7rem',
                            borderRadius: 3,
                            background: gridCols === p.c && gridRows === p.r ? '#0088ff' : '#1e2436',
                            color: gridCols === p.c && gridRows === p.r ? '#fff' : '#aaa',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            cursor: 'pointer',
                          }}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Upload Zone (shown when no image loaded) */}
          {!sheetImage ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: '2px dashed rgba(0, 136, 255, 0.4)',
                  borderRadius: 10,
                  padding: '3.5rem 2rem',
                  textAlign: 'center',
                  cursor: 'pointer',
                  backgroundColor: 'rgba(0, 136, 255, 0.04)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.8rem',
                  transition: 'all 0.2s ease',
                }}
              >
                <UploadIcon size={46} color="#0088ff" />
                <div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#fff', marginBottom: 4 }}>
                    Click or Drag & Drop Sprite Sheet Image Here
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#8888aa' }}>
                    Compatible with PNG, WebP, or JPG sprite sheets of any dimensions
                  </div>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />
              </div>

              {/* Quick Load Presets from Public Directory */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.8rem', flexWrap: 'wrap', padding: '0.5rem', background: '#0a0c12', borderRadius: 8, border: '1px solid #1c2233' }}>
                <span style={{ fontSize: '0.78rem', color: '#888' }}>Or test with sample sheets:</span>
                <button
                  onClick={() => loadSampleImage('/sprites/alex_walking_spritesheet.png', 'alex_walking_spritesheet.png')}
                  style={{
                    background: '#1a2238',
                    border: '1px solid rgba(0, 136, 255, 0.3)',
                    color: '#60a5fa',
                    padding: '4px 10px',
                    borderRadius: 5,
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Alex Walk Cycle (5888×256 • 23 Frames)
                </button>
                <button
                  onClick={() => loadSampleImage('/idle/alex_directional_spritesheet.png', 'alex_directional_spritesheet.png')}
                  style={{
                    background: '#1a2238',
                    border: '1px solid rgba(0, 136, 255, 0.3)',
                    color: '#60a5fa',
                    padding: '4px 10px',
                    borderRadius: 5,
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Alex Directional Sheet (8 Frames)
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* File Info & Mode Bar */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.6rem 0.9rem',
                  background: '#0d0f17',
                  borderRadius: 8,
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  flexWrap: 'wrap',
                  gap: '0.75rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                  <span style={{ fontSize: '0.85rem', color: '#00ff88', fontWeight: 700 }}>
                    {sheetFileName}
                  </span>
                  <span style={{ fontSize: '0.78rem', color: '#aaa' }}>
                    ({sheetImage.width}×{sheetImage.height} px)
                  </span>
                  <span style={{ fontSize: '0.78rem', color: '#38bdf8', background: 'rgba(0, 136, 255, 0.15)', padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>
                    {detectedFrames.length} Slices Ready
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  {/* Slicing Strategy Toggle */}
                  <div
                    style={{
                      display: 'flex',
                      background: '#1a1e2e',
                      borderRadius: 6,
                      padding: 2,
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                    }}
                  >
                    <button
                      onClick={() => setSlicingStrategy('UNIFORM')}
                      style={{
                        padding: '4px 10px',
                        borderRadius: 4,
                        border: 'none',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        background: slicingStrategy === 'UNIFORM' ? '#0088ff' : 'transparent',
                        color: slicingStrategy === 'UNIFORM' ? '#fff' : '#8888aa',
                      }}
                    >
                      Uniform Grid Slices
                    </button>
                    <button
                      onClick={() => setSlicingStrategy('AUTO_DETECT')}
                      style={{
                        padding: '4px 10px',
                        borderRadius: 4,
                        border: 'none',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        background: slicingStrategy === 'AUTO_DETECT' ? '#0088ff' : 'transparent',
                        color: slicingStrategy === 'AUTO_DETECT' ? '#fff' : '#8888aa',
                      }}
                    >
                      Auto-Detect Gaps
                    </button>
                  </div>

                  <button
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      background: '#24283b',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: 6,
                      color: '#ddd',
                      padding: '5px 10px',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    Change File
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                  />
                </div>
              </div>

              {/* Main Workspace: Canvas View & Frame Inspector */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '1rem', height: 440 }}>
                {/* Canvas Viewport */}
                <div
                  style={{
                    backgroundColor: '#0a0c12',
                    borderRadius: 8,
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    overflow: 'auto',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '1rem',
                    position: 'relative',
                  }}
                >
                  <canvas
                    ref={canvasRef}
                    onClick={handleCanvasClick}
                    style={{
                      maxWidth: '100%',
                      maxHeight: '100%',
                      objectFit: 'contain',
                      imageRendering: 'pixelated',
                      border: '1px solid rgba(0, 136, 255, 0.3)',
                      cursor: 'crosshair',
                      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 8,
                      left: 12,
                      fontSize: '0.72rem',
                      color: '#666',
                      background: 'rgba(0, 0, 0, 0.7)',
                      padding: '2px 8px',
                      borderRadius: 4,
                      pointerEvents: 'none',
                    }}
                  >
                    Click any tile to inspect and adjust crop
                  </div>
                </div>

                {/* Right Panel: Frame list & Crop fine-tuning */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                    background: '#0f121a',
                    padding: '0.9rem',
                    borderRadius: 8,
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    overflowY: 'auto',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0088ff', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                      Crop Fine-Tuning
                    </div>
                    {activeFrame && (
                      <button
                        onClick={() => handleDeleteFrame(selectedFrameIndex)}
                        title="Delete this frame from import"
                        style={{
                          background: 'rgba(255, 60, 60, 0.15)',
                          border: '1px solid rgba(255, 60, 60, 0.3)',
                          borderRadius: 4,
                          color: '#ff6b6b',
                          padding: '2px 6px',
                          fontSize: '0.7rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 3,
                        }}
                      >
                        <TrashIcon size={12} />
                        Remove
                      </button>
                    )}
                  </div>

                  {activeFrame ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.75rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 700, color: '#00ff88' }}>
                          Frame #{selectedFrameIndex + 1} of {detectedFrames.length}:
                        </span>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button
                            disabled={selectedFrameIndex === 0}
                            onClick={() => setSelectedFrameIndex((i) => Math.max(0, i - 1))}
                            style={{ padding: '2px 6px', background: '#202538', border: '1px solid #444', color: '#fff', borderRadius: 3, cursor: selectedFrameIndex === 0 ? 'not-allowed' : 'pointer' }}
                          >
                            <PrevIcon size={12} />
                          </button>
                          <button
                            disabled={selectedFrameIndex === detectedFrames.length - 1}
                            onClick={() => setSelectedFrameIndex((i) => Math.min(detectedFrames.length - 1, i + 1))}
                            style={{ padding: '2px 6px', background: '#202538', border: '1px solid #444', color: '#fff', borderRadius: 3, cursor: selectedFrameIndex === detectedFrames.length - 1 ? 'not-allowed' : 'pointer' }}
                          >
                            <NextIcon size={12} />
                          </button>
                        </div>
                      </div>

                      {/* X, Y, W, H crop inputs */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                        <div>
                          <label style={{ color: '#888', display: 'block', fontSize: '0.7rem' }}>X (px):</label>
                          <input
                            type="number"
                            value={Math.round(activeFrame.x)}
                            onChange={(e) => updateCurrentFrameCrop('x', Number(e.target.value))}
                            style={{ width: '100%', padding: '3px 5px', background: '#1c202d', border: '1px solid #334', color: '#fff', borderRadius: 4 }}
                          />
                        </div>
                        <div>
                          <label style={{ color: '#888', display: 'block', fontSize: '0.7rem' }}>Y (px):</label>
                          <input
                            type="number"
                            value={Math.round(activeFrame.y)}
                            onChange={(e) => updateCurrentFrameCrop('y', Number(e.target.value))}
                            style={{ width: '100%', padding: '3px 5px', background: '#1c202d', border: '1px solid #334', color: '#fff', borderRadius: 4 }}
                          />
                        </div>
                        <div>
                          <label style={{ color: '#888', display: 'block', fontSize: '0.7rem' }}>Width (px):</label>
                          <input
                            type="number"
                            value={Math.round(activeFrame.w)}
                            onChange={(e) => updateCurrentFrameCrop('w', Number(e.target.value))}
                            style={{ width: '100%', padding: '3px 5px', background: '#1c202d', border: '1px solid #334', color: '#fff', borderRadius: 4 }}
                          />
                        </div>
                        <div>
                          <label style={{ color: '#888', display: 'block', fontSize: '0.7rem' }}>Height (px):</label>
                          <input
                            type="number"
                            value={Math.round(activeFrame.h)}
                            onChange={(e) => updateCurrentFrameCrop('h', Number(e.target.value))}
                            style={{ width: '100%', padding: '3px 5px', background: '#1c202d', border: '1px solid #334', color: '#fff', borderRadius: 4 }}
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ color: '#666', fontSize: '0.75rem' }}>No frame selected</div>
                  )}

                  {/* Frame list strip */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.4rem' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#aaa' }}>
                      Tiles to Import ({detectedFrames.length}):
                    </div>
                    <button
                      onClick={() => recalculateFrames()}
                      title="Reset all frame boundaries"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#0088ff',
                        fontSize: '0.7rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 2,
                      }}
                    >
                      <ResetIcon size={12} />
                      Reset
                    </button>
                  </div>

                  <div
                    style={{
                      flex: 1,
                      overflowY: 'auto',
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, 1fr)',
                      gap: '0.35rem',
                      maxHeight: 180,
                    }}
                  >
                    {detectedFrames.map((f, i) => {
                      const isSelected = i === selectedFrameIndex;
                      return (
                        <div
                          key={i}
                          onClick={() => setSelectedFrameIndex(i)}
                          style={{
                            padding: '4px 6px',
                            borderRadius: 4,
                            background: isSelected ? 'rgba(0, 136, 255, 0.25)' : '#161925',
                            border: isSelected ? '1px solid #0088ff' : '1px solid rgba(255, 255, 255, 0.05)',
                            cursor: 'pointer',
                            fontSize: '0.7rem',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <span style={{ fontWeight: isSelected ? 700 : 400, color: isSelected ? '#38bdf8' : '#cbd5e1' }}>
                            #{i + 1}
                          </span>
                          <span style={{ fontSize: '0.62rem', color: '#888' }}>
                            {Math.round(f.w)}×{Math.round(f.h)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '1rem 1.25rem',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: '#0f1118',
          }}
        >
          <button
            onClick={onClose}
            style={{
              background: '#24283b',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: 6,
              color: '#fff',
              padding: '0.5rem 1.1rem',
              fontSize: '0.85rem',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>

          <button
            disabled={!sheetImage || detectedFrames.length === 0}
            onClick={handleConfirmImport}
            style={{
              background: !sheetImage || detectedFrames.length === 0 ? '#333' : '#0088ff',
              border: 'none',
              borderRadius: 6,
              color: '#fff',
              fontWeight: 700,
              padding: '0.55rem 1.35rem',
              fontSize: '0.85rem',
              cursor: !sheetImage || detectedFrames.length === 0 ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              boxShadow: !sheetImage || detectedFrames.length === 0 ? 'none' : '0 4px 14px rgba(0, 136, 255, 0.4)',
            }}
          >
            <CheckIcon size={17} weight="bold" />
            Import {detectedFrames.length} Frames into Anchors
          </button>
        </div>
      </div>
    </div>
  );
};
