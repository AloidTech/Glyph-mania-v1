import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Play as PlayIcon,
  Pause as PauseIcon,
  CaretLeft as PrevIcon,
  CaretRight as NextIcon,
  FileArrowUp as UploadIcon,
  DownloadSimple as DownloadIcon,
  Sparkle as SparkleIcon,
  Check as CheckIcon,
  Trash as TrashIcon,
  GridFour as GridIcon,
  Sliders as SlidersIcon,
  X as CloseIcon,
  ArrowCounterClockwise as ResetIcon,
  CaretDown as CaretDownIcon,
  CaretUp as CaretUpIcon,
  FilmStrip as FilmStripIcon,
} from '@phosphor-icons/react';
import { useNavigate } from 'react-router-dom';
import {
  ExtractedFrame,
  extractFramesFromVideo,
  generateDemoWalkCycle,
} from '../../lib/sprites/videoFrameExtractor';
import {
  removeChromaBackground,
  downscaleNearestNeighbor,
  generateSpriteSheet,
  downloadCanvasAsPng,
  hexToRgb,
  getNonTransparentBounds,
  normalizeSpritePadding,
  SpriteSheetPaddingConfig,
} from '../../lib/sprites/spriteProcessor';
import { useSpriteTransferStore } from '../../lib/stores/spriteTransferStore';
import { useSpriteStudioSettingsStore } from '../../lib/stores/spriteStudioSettingsStore';

export const VideoFramePickerPage: React.FC = () => {
  const navigate = useNavigate();
  const { stageFrames } = useSpriteTransferStore();
  const [frames, setFrames] = useState<ExtractedFrame[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [fileName, setFileName] = useState<string>('demo-walk-cycle.mp4');
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [extractProgress, setExtractProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });
  const [isFilmstripOpen, setIsFilmstripOpen] = useState<boolean>(true);

  // Cycle selection state
  const [startIndex, setStartIndex] = useState<number | null>(null);
  const [endIndex, setEndIndex] = useState<number | null>(null);
  const [targetCount, setTargetCount] = useState<number>(8);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());

  // Playback state
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playSelectedOnly, setPlaySelectedOnly] = useState<boolean>(false);
  const [playbackFps, setPlaybackFps] = useState<number>(12);

  // Chroma keying on preview & export
  const [removeChroma, setRemoveChroma] = useState<boolean>(false);
  const [chromaHex, setChromaHex] = useState<string>('#00FF00');
  const [tolerance, setTolerance] = useState<number>(55);
  const [smoothness, setSmoothness] = useState<number>(4);
  const [cleanUpEdges, setCleanUpEdges] = useState<number>(2);
  const [isChromaModalOpen, setIsChromaModalOpen] = useState<boolean>(false);
  const [exportSize, setExportSize] = useState<256 | 512 | 1024>(256);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mainPreviewCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Sorted list of selected indices for locked scrubbing
  const sortedSelected = useMemo(() => {
    return Array.from(selectedIndices).sort((a, b) => a - b);
  }, [selectedIndices]);

  // Load demo cycle on initial mount so tool is immediately interactive
  useEffect(() => {
    const demo = generateDemoWalkCycle();
    setFrames(demo);
    setCurrentIndex(0);
    setStartIndex(0);
    setEndIndex(demo.length - 1);
    setTargetCount(8);

    // Initial distribute 8 frames
    distributeFrames(0, demo.length - 1, 8, demo.length);
  }, []);

  const totalFrames = frames.length;
  const currentFrame = frames[currentIndex] || null;

  // Distribute N evenly spaced frames between start and end
  const distributeFrames = (start: number, end: number, count: number, total: number) => {
    if (start > end) {
      const temp = start;
      start = end;
      end = temp;
    }

    const newSet = new Set<number>();
    if (count <= 1) {
      newSet.add(start);
    } else {
      const range = end - start;
      for (let i = 0; i < count; i++) {
        const frameIdx = Math.round(start + (i * range) / (count - 1));
        if (frameIdx >= 0 && frameIdx < total) {
          newSet.add(frameIdx);
        }
      }
    }
    setSelectedIndices(newSet);
  };

  const handleDistributeClick = () => {
    const s = startIndex !== null ? startIndex : 0;
    const e = endIndex !== null ? endIndex : totalFrames - 1;
    distributeFrames(s, e, targetCount, totalFrames);
  };

  // Toggle selection on current frame
  const handleToggleCurrent = () => {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(currentIndex)) {
        next.delete(currentIndex);
      } else {
        next.add(currentIndex);
      }
      return next;
    });
  };

  const handleClearSelected = () => {
    setSelectedIndices(new Set());
  };

  // Ensure currentIndex is locked strictly to a selected frame when playSelectedOnly is active
  useEffect(() => {
    if (playSelectedOnly && sortedSelected.length > 0 && !selectedIndices.has(currentIndex)) {
      // Snap to closest selected frame
      let closest = sortedSelected[0];
      let minDiff = Math.abs(closest - currentIndex);
      for (let i = 1; i < sortedSelected.length; i++) {
        const diff = Math.abs(sortedSelected[i] - currentIndex);
        if (diff < minDiff) {
          minDiff = diff;
          closest = sortedSelected[i];
        }
      }
      setCurrentIndex(closest);
    }
  }, [playSelectedOnly, sortedSelected, selectedIndices, currentIndex]);

  // Step prev / next
  const handleStep = (delta: number) => {
    if (totalFrames === 0) return;
    if (playSelectedOnly) {
      if (sortedSelected.length === 0) return;
      let currentPos = sortedSelected.indexOf(currentIndex);
      if (currentPos === -1) currentPos = 0;
      const nextPos = (currentPos + delta + sortedSelected.length) % sortedSelected.length;
      setCurrentIndex(sortedSelected[nextPos]);
    } else {
      const next = (currentIndex + delta + totalFrames) % totalFrames;
      setCurrentIndex(next);
    }
  };

  // Keyboard navigation shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handleStep(-1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleStep(1);
      } else if (e.key === ' ') {
        e.preventDefault();
        setIsPlaying((p) => !p);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, totalFrames, playSelectedOnly, sortedSelected]);

  // Playback timer loop
  useEffect(() => {
    if (!isPlaying || totalFrames === 0) return;

    const interval = window.setInterval(() => {
      if (playSelectedOnly) {
        if (sortedSelected.length === 0) return;
        setCurrentIndex((prev) => {
          const idx = sortedSelected.indexOf(prev);
          const nextIdx = idx === -1 ? 0 : (idx + 1) % sortedSelected.length;
          return sortedSelected[nextIdx];
        });
      } else {
        setCurrentIndex((prev) => (prev + 1) % totalFrames);
      }
    }, 1000 / playbackFps);

    return () => clearInterval(interval);
  }, [isPlaying, playSelectedOnly, totalFrames, playbackFps, sortedSelected]);

  // Draw current frame onto main canvas
  useEffect(() => {
    const canvas = mainPreviewCanvasRef.current;
    if (!canvas || !currentFrame) return;

    canvas.width = currentFrame.canvas.width;
    canvas.height = currentFrame.canvas.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;

    if (removeChroma) {
      const cleaned = removeChromaBackground(currentFrame.canvas, hexToRgb(chromaHex), tolerance, smoothness, cleanUpEdges);
      ctx.drawImage(cleaned, 0, 0);
    } else {
      ctx.drawImage(currentFrame.canvas, 0, 0);
    }
  }, [currentFrame, removeChroma, chromaHex, tolerance, smoothness, cleanUpEdges]);

  // Handle video upload
  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    setFileName(file.name);
    setIsExtracting(true);
    setExtractProgress({ current: 0, total: 0 });

    try {
      const extracted = await extractFramesFromVideo(file, {
        fps: 24,
        maxFrames: 150,
        onProgress: (current, total) => {
          setExtractProgress({ current, total });
        },
      });

      if (extracted.length > 0) {
        setFrames(extracted);
        setCurrentIndex(0);
        setStartIndex(0);
        setEndIndex(extracted.length - 1);
        distributeFrames(0, extracted.length - 1, targetCount, extracted.length);
      }
    } catch (err) {
      console.error('Video extraction failed:', err);
      alert('Failed to extract video frames. Please check that the video format is supported.');
    } finally {
      setIsExtracting(false);
    }
  };

  // Export handlers
  const handleExportSelectedSpritesheet = () => {
    const sorted = Array.from(selectedIndices).sort((a, b) => a - b);
    if (sorted.length === 0) {
      alert('No frames selected to export.');
      return;
    }

    const { normConfig } = useSpriteStudioSettingsStore.getState();
    const calculatedHeight = Math.round((normConfig.targetCanvasSize * normConfig.targetHeightPercent) / 100);
    const calculatedBaseline = Math.round(normConfig.targetCanvasSize * (1 - normConfig.bottomBaselinePercent / 100));
    const calculatedHeadroom = Math.round(calculatedBaseline - calculatedHeight);
    const calculatedBottomMargin = Math.round((normConfig.targetCanvasSize * normConfig.bottomBaselinePercent) / 100);
    const toGamePx = (pxVal: number) => Math.round((pxVal * exportSize) / normConfig.targetCanvasSize);

    const paddingMetadata: SpriteSheetPaddingConfig = {
      targetCanvasSize: normConfig.targetCanvasSize,
      outputLogicalSize: exportSize,
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

    const processedFrames = sorted.map((frameIdx, seq) => {
      const f = frames[frameIdx];
      let canvasToUse = f.canvas;

      if (removeChroma) {
        canvasToUse = removeChromaBackground(f.canvas, hexToRgb(chromaHex), tolerance, smoothness, cleanUpEdges);
      }

      // Step 1: Find non-transparent bounds
      const bounds = getNonTransparentBounds(canvasToUse);
      let normalizedCanvas = canvasToUse;
      if (bounds) {
        // Step 2: Normalize character height, ground margin & center
        const normResult = normalizeSpritePadding(canvasToUse, bounds, {
          ...normConfig,
          outputLogicalSize: exportSize,
        });
        normalizedCanvas = normResult.canvas;
      }

      const downscaled = downscaleNearestNeighbor(normalizedCanvas, exportSize);
      return {
        name: `walk_step_${seq}`,
        canvas: downscaled,
      };
    });

    const { canvas: sheetCanvas, phaserConfig } = generateSpriteSheet(processedFrames, exportSize, paddingMetadata);
    downloadCanvasAsPng(sheetCanvas, `${fileName.replace(/\.[^/.]+$/, '')}_walk_spritesheet.png`);

    // Download Phaser JSON config with complete padding metadata
    const blob = new Blob([phaserConfig], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName.replace(/\.[^/.]+$/, '')}_spritesheet_config.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Transfer selected frames to Sprite Studio for interactive padding, scaling, and preview
  const handleSendToSpriteStudio = () => {
    const sorted = Array.from(selectedIndices).sort((a, b) => a - b);
    if (sorted.length === 0) {
      alert('Please select at least one frame to send to Sprite Studio.');
      return;
    }

    const baseName = fileName.replace(/\.[^/.]+$/, '') || 'frame';
    const staged = sorted.map((frameIdx, seq) => {
      const f = frames[frameIdx];
      let canvasToUse = f.canvas;
      if (removeChroma) {
        canvasToUse = removeChromaBackground(f.canvas, hexToRgb(chromaHex), tolerance, smoothness, cleanUpEdges);
      }
      return {
        name: `${baseName}_frame_${String(seq + 1).padStart(2, '0')}`,
        canvas: canvasToUse,
      };
    });

    stageFrames(staged, 'video_frame_picker');
    navigate('/admin_dashboard/sprites');
  };

  const handleExportIndividualPngs = () => {
    const sorted = Array.from(selectedIndices).sort((a, b) => a - b);
    if (sorted.length === 0) {
      alert('No frames selected.');
      return;
    }

    sorted.forEach((frameIdx, seq) => {
      const f = frames[frameIdx];
      let canvasToUse = f.canvas;
      if (removeChroma) {
        canvasToUse = removeChromaBackground(f.canvas, hexToRgb(chromaHex), tolerance, smoothness, cleanUpEdges);
      }
      const finalCanvas = exportSize !== f.canvas.width ? downscaleNearestNeighbor(canvasToUse, exportSize) : canvasToUse;
      downloadCanvasAsPng(finalCanvas, `frame_${String(seq + 1).padStart(2, '0')}.png`);
    });
  };

  const isCurrentStart = startIndex === currentIndex;
  const isCurrentEnd = endIndex === currentIndex;
  const isCurrentSelected = selectedIndices.has(currentIndex);

  return (
    <div
      style={{
        padding: '1.25rem 1.5rem',
        maxWidth: 1440,
        margin: '0 auto',
        color: '#ffffff',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <style>{`
        .square-scrub-slider {
          -webkit-appearance: none;
          appearance: none;
          height: 6px;
          background: #1a1a2e;
          outline: none;
          border-radius: 2px;
          border: 1px solid rgba(255, 255, 255, 0.18);
        }
        .square-scrub-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 14px;
          height: 14px;
          background: #0088ff;
          border: 1px solid #ffffff;
          border-radius: 2px;
          cursor: pointer;
          box-shadow: 0 0 6px rgba(0, 136, 255, 0.6);
        }
        .square-scrub-slider::-webkit-slider-thumb:hover {
          background: #33aaff;
          transform: scale(1.1);
        }
        .square-scrub-slider::-moz-range-thumb {
          width: 14px;
          height: 14px;
          background: #0088ff;
          border: 1px solid #ffffff;
          border-radius: 2px;
          cursor: pointer;
        }
        .square-scrub-slider::-moz-range-track {
          height: 6px;
          background: #1a1a2e;
          border: 1px solid rgba(255, 255, 255, 0.18);
          border-radius: 2px;
        }
      `}</style>
      {/* Video Player Card */}
      <div
        style={{
          background: '#0a0a12',
          borderRadius: 10,
          border: '1px solid rgba(255, 255, 255, 0.1)',
          overflow: 'hidden',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
        }}
      >
        {/* Top Header Bar */}
        <div
          style={{
            background: '#12121e',
            padding: '0.75rem 1.25rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.85rem',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            fontSize: '0.85rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <SparkleIcon size={18} color="#0088ff" weight="fill" />
              <span style={{ fontWeight: 800, letterSpacing: '0.06em', color: '#e0e0ff' }}>FRAME PICKER</span>
            </div>
            <span
              style={{
                fontWeight: 800,
                fontFamily: 'monospace',
                background: 'rgba(0, 255, 136, 0.12)',
                color: '#00ff88',
                padding: '2px 8px',
                borderRadius: 4,
                fontSize: '0.85rem',
                border: '1px solid rgba(0, 255, 136, 0.25)',
              }}
            >
              {totalFrames > 0 ? `${currentIndex + 1} / ${totalFrames}` : '0 / 0'}
            </span>
            <span style={{ color: '#8888aa', fontFamily: 'monospace', fontSize: '0.8rem' }}>{fileName}</span>
          </div>

          {/* Legend & Upload */}
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', fontSize: '0.78rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: '#0088ff' }} />
                <span style={{ color: '#ccc' }}>selected</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: '#00ff88' }} />
                <span style={{ color: '#ccc' }}>start</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: '#ff3344' }} />
                <span style={{ color: '#ccc' }}>end</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: '#e2b714' }} />
                <span style={{ color: '#ccc' }}>viewing</span>
              </div>
            </div>

            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                background: '#242438',
                border: '1px solid rgba(0, 136, 255, 0.35)',
                borderRadius: 6,
                color: '#fff',
                padding: '0.4rem 0.85rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontSize: '0.8rem',
                fontWeight: 600,
              }}
            >
              <UploadIcon size={15} color="#33aaff" />
              Upload Video
            </button>
            <input
              type="file"
              ref={fileInputRef}
              accept="video/*"
              onChange={handleVideoUpload}
              style={{ display: 'none' }}
            />
          </div>
        </div>

        {/* Main Center Preview Viewport */}
        <div
          style={{
            background: '#08080f',
            height: 480,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {isExtracting ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#00ff88', marginBottom: '0.5rem' }}>
                Extracting Video Frames...
              </div>
              <div style={{ color: '#aaa', fontSize: '0.85rem' }}>
                Frame {extractProgress.current} of {extractProgress.total}
              </div>
            </div>
          ) : (
            <canvas
              ref={mainPreviewCanvasRef}
              style={{
                maxHeight: '94%',
                maxWidth: '94%',
                boxShadow: '0 8px 32px rgba(0,0,0,0.8)',
                borderRadius: 4,
                imageRendering: 'pixelated',
              }}
            />
          )}

          {/* Floating Status Badges on Canvas */}
          <div style={{ position: 'absolute', top: 16, left: 16, display: 'flex', gap: 6 }}>
            {isCurrentStart && (
              <span style={{ background: '#00ff88', color: '#000', fontWeight: 800, padding: '3px 8px', borderRadius: 4, fontSize: '0.75rem' }}>
                START FRAME
              </span>
            )}
            {isCurrentEnd && (
              <span style={{ background: '#ff3344', color: '#fff', fontWeight: 800, padding: '3px 8px', borderRadius: 4, fontSize: '0.75rem' }}>
                END FRAME
              </span>
            )}
            {isCurrentSelected && (
              <span style={{ background: '#0088ff', color: '#fff', fontWeight: 800, padding: '3px 8px', borderRadius: 4, fontSize: '0.75rem' }}>
                ✓ SELECTED
              </span>
            )}
          </div>

          {/* Quick Chroma Key Trigger Badge */}
          <div
            style={{
              position: 'absolute',
              bottom: 12,
              right: 12,
              background: 'rgba(20, 20, 32, 0.92)',
              backdropFilter: 'blur(8px)',
              borderRadius: 6,
              padding: '0.35rem 0.65rem',
              border: removeChroma ? '1px solid #00ff88' : '1px solid rgba(255, 255, 255, 0.15)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              fontSize: '0.78rem',
              boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
              zIndex: 10,
            }}
          >
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer', color: removeChroma ? '#00ff88' : '#ddd', fontWeight: 600 }}>
              <input
                type="checkbox"
                checked={removeChroma}
                onChange={(e) => setRemoveChroma(e.target.checked)}
              />
              Remove BG
            </label>
            <div
              style={{
                width: 18,
                height: 18,
                borderRadius: 3,
                background: chromaHex,
                border: '1px solid rgba(255, 255, 255, 0.3)',
              }}
            />
            <button
              type="button"
              onClick={() => setIsChromaModalOpen(true)}
              style={{
                background: '#242436',
                border: '1px solid rgba(255, 255, 255, 0.25)',
                borderRadius: 4,
                color: '#fff',
                padding: '2px 8px',
                fontSize: '0.72rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                fontWeight: 600,
              }}
              title="Open Background Removal Settings"
            >
              <SlidersIcon size={12} color="#00ff88" />
              Settings
            </button>
          </div>

          {/* Background Removal Mini Modal */}
          {isChromaModalOpen && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0, 0, 0, 0.65)',
                backdropFilter: 'blur(4px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 30,
              }}
              onClick={() => setIsChromaModalOpen(false)}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  background: '#161622',
                  border: '1px solid rgba(0, 255, 136, 0.35)',
                  boxShadow: '0 16px 48px rgba(0, 0, 0, 0.85)',
                  borderRadius: '10px',
                  width: 400,
                  maxWidth: '92%',
                  padding: '1.25rem',
                  color: '#fff',
                }}
              >
                {/* Modal Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <SlidersIcon size={18} color="#00ff88" />
                    <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>Background Removal Settings</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsChromaModalOpen(false)}
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

                {/* Master Enable Checkbox */}
                <div style={{ marginBottom: '1rem', padding: '0.6rem 0.75rem', background: 'rgba(0, 255, 136, 0.08)', borderRadius: 6, border: '1px solid rgba(0, 255, 136, 0.2)' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>
                    <input
                      type="checkbox"
                      checked={removeChroma}
                      onChange={(e) => setRemoveChroma(e.target.checked)}
                    />
                    Enable Background Removal
                  </label>
                </div>

                {/* Chroma Color & Swatches */}
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ fontSize: '0.8rem', color: '#aaa', display: 'block', marginBottom: '0.35rem' }}>
                    Chroma Color:
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input
                      type="color"
                      value={chromaHex}
                      onChange={(e) => setChromaHex(e.target.value)}
                      style={{ width: 36, height: 30, border: 'none', borderRadius: 4, cursor: 'pointer', background: 'transparent' }}
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
                        padding: '0.35rem 0.5rem',
                        fontSize: '0.82rem',
                        fontFamily: 'monospace',
                        width: 85,
                      }}
                    />
                    {['#00FF00', '#FF00FF', '#000000', '#FFFFFF'].map((swatch) => (
                      <button
                        key={swatch}
                        type="button"
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

                {/* Tolerance Slider */}
                <div style={{ marginBottom: '0.9rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
                    <span style={{ color: '#aaa' }}>Color Distance Tolerance:</span>
                    <span style={{ fontFamily: 'monospace', color: '#00ff88', fontWeight: 700 }}>{tolerance}</span>
                  </div>
                  <input
                    type="range"
                    min={5}
                    max={240}
                    value={tolerance}
                    onChange={(e) => setTolerance(Number(e.target.value))}
                    style={{ width: '100%', cursor: 'pointer', accentColor: '#0088ff' }}
                  />
                </div>

                {/* Edge Defringe Slider */}
                <div style={{ marginBottom: '0.9rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
                    <span style={{ color: '#aaa' }}>Edge Defringe & Feathering:</span>
                    <span style={{ fontFamily: 'monospace', color: '#00ff88', fontWeight: 700 }}>{smoothness} px</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={25}
                    value={smoothness}
                    onChange={(e) => setSmoothness(Number(e.target.value))}
                    style={{ width: '100%', cursor: 'pointer', accentColor: '#0088ff' }}
                  />
                </div>

                {/* Clean Up Edges Slider + Presets */}
                <div style={{ marginBottom: '1.2rem', padding: '0.75rem', background: 'rgba(0, 255, 136, 0.05)', borderRadius: 8, border: '1px solid rgba(0, 255, 136, 0.2)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700 }}>Clean up edges</span>
                    <span style={{ fontFamily: 'monospace', background: '#00ff88', color: '#000', fontWeight: 800, fontSize: '0.78rem', padding: '1px 6px', borderRadius: 3 }}>
                      {cleanUpEdges} pixels
                    </span>
                  </div>
                  <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.72rem', color: '#8888aa' }}>
                    (removes fuzzy semi-transparent pixels from edge)
                  </p>
                  <input
                    type="range"
                    min={0}
                    max={6}
                    value={cleanUpEdges}
                    onChange={(e) => setCleanUpEdges(Number(e.target.value))}
                    style={{ width: '100%', cursor: 'pointer', accentColor: '#00ff88', marginBottom: '0.4rem' }}
                  />
                  <div style={{ display: 'flex', gap: '0.3rem' }}>
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
                          padding: '0.25rem 0',
                          borderRadius: 4,
                          background: cleanUpEdges === preset.px ? '#00ff88' : '#242436',
                          color: cleanUpEdges === preset.px ? '#000' : '#ccc',
                          fontWeight: cleanUpEdges === preset.px ? 800 : 500,
                          border: '1px solid rgba(255, 255, 255, 0.15)',
                          fontSize: '0.7rem',
                          cursor: 'pointer',
                        }}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Footer Actions */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setTolerance(55);
                      setSmoothness(4);
                      setCleanUpEdges(2);
                      setChromaHex('#00FF00');
                    }}
                    style={{
                      background: 'transparent',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      color: '#aaa',
                      borderRadius: 4,
                      padding: '0.35rem 0.65rem',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 3,
                    }}
                  >
                    <ResetIcon size={12} />
                    Defaults
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsChromaModalOpen(false)}
                    style={{
                      background: '#00ff88',
                      color: '#000',
                      fontWeight: 700,
                      border: 'none',
                      borderRadius: 4,
                      padding: '0.4rem 1.1rem',
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                    }}
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Control Decks ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginTop: '0.75rem' }}>
        {/* Deck 1: Playback & Interactive Scrubber */}
        <div
          style={{
            background: '#13131f',
            borderRadius: 8,
            padding: '0.85rem 1.25rem',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          {/* Transport Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              style={{
                background: isPlaying ? '#ff3344' : '#0088ff',
                border: 'none',
                borderRadius: 5,
                color: '#fff',
                padding: '0.5rem 0.95rem',
                fontWeight: 700,
                fontSize: '0.82rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                boxShadow: isPlaying ? '0 2px 8px rgba(255, 51, 68, 0.4)' : '0 2px 8px rgba(0, 136, 255, 0.4)',
                transition: 'all 0.15s ease',
              }}
            >
              {isPlaying ? <PauseIcon size={15} weight="bold" /> : <PlayIcon size={15} weight="bold" />}
              {isPlaying ? 'Pause' : 'Play'}
            </button>

            <button
              onClick={() => handleStep(-1)}
              style={{
                background: '#222232',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: 5,
                color: '#fff',
                padding: '0.5rem 0.75rem',
                fontSize: '0.82rem',
                cursor: 'pointer',
              }}
              title="Previous Frame (Left Arrow)"
            >
              <PrevIcon size={14} />
            </button>

            <button
              onClick={() => handleStep(1)}
              style={{
                background: '#222232',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: 5,
                color: '#fff',
                padding: '0.5rem 0.75rem',
                fontSize: '0.82rem',
                cursor: 'pointer',
              }}
              title="Next Frame (Right Arrow)"
            >
              <NextIcon size={14} />
            </button>

            {/* FPS Selector */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                background: '#0d0d16',
                borderRadius: 5,
                padding: '2px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                marginLeft: '0.35rem',
              }}
            >
              {[8, 12, 16, 24].map((fps) => (
                <button
                  key={fps}
                  onClick={() => setPlaybackFps(fps)}
                  style={{
                    padding: '3px 7px',
                    borderRadius: 3,
                    background: playbackFps === fps ? '#0088ff' : 'transparent',
                    border: 'none',
                    color: playbackFps === fps ? '#fff' : '#888',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {fps}
                </button>
              ))}
              <span style={{ fontSize: '0.68rem', color: '#666', padding: '0 4px', fontWeight: 600 }}>fps</span>
            </div>
          </div>

          {/* Scrubber Area */}
          <div style={{ flex: 1, minWidth: 260, display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontSize: '0.78rem',
                color: playSelectedOnly ? '#00ff88' : '#bbb',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                fontWeight: 600,
              }}
            >
              <input
                type="checkbox"
                checked={playSelectedOnly}
                onChange={(e) => {
                  const next = e.target.checked;
                  setPlaySelectedOnly(next);
                  if (next && sortedSelected.length > 0 && !selectedIndices.has(currentIndex)) {
                    setCurrentIndex(sortedSelected[0]);
                  }
                }}
              />
              Selected only
            </label>

            {(() => {
              const scrubList = playSelectedOnly ? sortedSelected : null;
              const scrubMax = scrubList ? Math.max(0, scrubList.length - 1) : Math.max(0, totalFrames - 1);
              const scrubVal = scrubList
                ? Math.max(0, scrubList.indexOf(currentIndex) === -1 ? 0 : scrubList.indexOf(currentIndex))
                : currentIndex;
              const isDisabled = scrubList ? scrubList.length <= 1 : totalFrames <= 1;

              return (
                <input
                  type="range"
                  min={0}
                  max={scrubMax}
                  step={1}
                  value={scrubVal}
                  disabled={isDisabled}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    if (scrubList) {
                      if (scrubList[val] !== undefined) {
                        setCurrentIndex(scrubList[val]);
                      }
                    } else {
                      setCurrentIndex(val);
                    }
                  }}
                  className="square-scrub-slider"
                  style={{ flex: 1, cursor: isDisabled ? 'not-allowed' : 'pointer' }}
                  title={
                    scrubList
                      ? `Selected Frame ${scrubVal + 1} of ${scrubList.length} (Frame #${currentIndex})`
                      : `Frame ${currentIndex + 1} of ${totalFrames}`
                  }
                />
              );
            })()}

            <span
              style={{
                fontSize: '0.8rem',
                fontFamily: 'monospace',
                color: '#00ff88',
                fontWeight: 700,
                whiteSpace: 'nowrap',
              }}
            >
              {currentIndex + 1} / {totalFrames}
            </span>
          </div>

          {/* Quick BG Removal Trigger */}
          <button
            type="button"
            onClick={() => setIsChromaModalOpen(true)}
            style={{
              background: removeChroma ? 'rgba(0, 255, 136, 0.14)' : '#222232',
              border: removeChroma ? '1px solid #00ff88' : '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: 5,
              color: removeChroma ? '#00ff88' : '#ddd',
              padding: '0.45rem 0.75rem',
              fontSize: '0.78rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontWeight: 600,
              whiteSpace: 'nowrap',
            }}
            title="Configure chroma background removal"
          >
            <SlidersIcon size={14} color={removeChroma ? '#00ff88' : '#aaa'} />
            BG Removal {removeChroma ? 'ON' : 'OFF'}
          </button>
        </div>

        {/* Collapsible Extracted Frames Dropdown Filmstrip (Visible Along with Video) */}
        <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', background: '#0e0e18' }}>
          {/* Dropdown Toggle Header */}
          <button
            type="button"
            onClick={() => setIsFilmstripOpen((prev) => !prev)}
            style={{
              width: '100%',
              padding: '0.6rem 1.25rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: isFilmstripOpen ? 'rgba(0, 136, 255, 0.06)' : 'rgba(255, 255, 255, 0.02)',
              border: 'none',
              borderBottom: isFilmstripOpen ? '1px solid rgba(255, 255, 255, 0.06)' : 'none',
              cursor: 'pointer',
              color: '#e0e0ff',
              transition: 'background 0.15s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.65rem' }}>
              <FilmStripIcon size={18} color="#00ff88" weight="bold" />
              <span style={{ fontWeight: 800, fontSize: '0.84rem', letterSpacing: '0.04em' }}>
                EXTRACTED VIDEO FRAMES
              </span>
              <span
                style={{
                  fontSize: '0.72rem',
                  padding: '2px 8px',
                  borderRadius: 10,
                  background: 'rgba(0, 255, 136, 0.12)',
                  color: '#00ff88',
                  fontWeight: 700,
                  border: '1px solid rgba(0, 255, 136, 0.25)',
                  fontFamily: 'monospace',
                }}
              >
                {totalFrames} Frames
              </span>
              <span
                style={{
                  fontSize: '0.72rem',
                  padding: '2px 8px',
                  borderRadius: 10,
                  background: 'rgba(0, 136, 255, 0.15)',
                  color: '#33aaff',
                  fontWeight: 700,
                  border: '1px solid rgba(0, 136, 255, 0.3)',
                  fontFamily: 'monospace',
                }}
              >
                {selectedIndices.size} in Loop
              </span>
              <span style={{ fontSize: '0.75rem', color: '#8888aa', marginLeft: '0.4rem' }}>
                • Click card to preview on video canvas
              </span>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                color: isFilmstripOpen ? '#33aaff' : '#8888bb',
                fontSize: '0.78rem',
                fontWeight: 700,
              }}
            >
              <span>{isFilmstripOpen ? 'Collapse Filmstrip' : 'Expand Filmstrip'}</span>
              {isFilmstripOpen ? <CaretUpIcon size={15} weight="bold" /> : <CaretDownIcon size={15} weight="bold" />}
            </div>
          </button>

          {/* Horizontally Scrollable Filmstrip Deck */}
          {isFilmstripOpen && (
            <div
              style={{
                display: 'flex',
                gap: '0.6rem',
                overflowX: 'auto',
                padding: '0.85rem 1.25rem 1rem',
                background: '#090912',
                scrollbarWidth: 'thin',
              }}
            >
              {frames.length === 0 ? (
                <div style={{ color: '#666688', fontSize: '0.82rem', padding: '1rem 0' }}>
                  No frames extracted yet. Upload a video above or use the demo cycle.
                </div>
              ) : (
                frames.map((frame, idx) => {
                  const isViewing = idx === currentIndex;
                  const isStart = idx === startIndex;
                  const isEnd = idx === endIndex;
                  const isSelected = selectedIndices.has(idx);

                  let borderColor = 'rgba(255, 255, 255, 0.1)';
                  let cardBg = '#141420';
                  if (isViewing) {
                    borderColor = '#e2b714';
                    cardBg = 'rgba(226, 183, 20, 0.12)';
                  } else if (isSelected) {
                    borderColor = '#0088ff';
                    cardBg = 'rgba(0, 136, 255, 0.08)';
                  }

                  return (
                    <div
                      key={idx}
                      onClick={() => {
                        if (playSelectedOnly && !selectedIndices.has(idx)) {
                          setSelectedIndices((prev) => new Set(prev).add(idx));
                        }
                        setCurrentIndex(idx);
                      }}
                      style={{
                        flex: '0 0 108px',
                        minWidth: 108,
                        background: cardBg,
                        border: `2px solid ${borderColor}`,
                        borderRadius: 7,
                        padding: '0.45rem',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '0.35rem',
                        position: 'relative',
                        transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                        boxShadow: isViewing ? '0 0 12px rgba(226, 183, 20, 0.4)' : 'none',
                        userSelect: 'none',
                      }}
                      title={`Frame #${idx + 1} (click to view)`}
                    >
                      {/* Frame Thumbnail */}
                      <div
                        style={{
                          width: '100%',
                          height: 72,
                          backgroundColor: '#0a0a10',
                          backgroundImage: `
                            linear-gradient(45deg, #14141e 25%, transparent 25%), 
                            linear-gradient(-45deg, #14141e 25%, transparent 25%), 
                            linear-gradient(45deg, transparent 75%, #14141e 75%), 
                            linear-gradient(-45deg, transparent 75%, #14141e 75%)
                          `,
                          backgroundSize: '12px 12px',
                          borderRadius: 4,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          overflow: 'hidden',
                        }}
                      >
                        <img
                          src={frame.dataUrl}
                          alt={`Frame ${idx + 1}`}
                          style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain', imageRendering: 'pixelated' }}
                        />
                      </div>

                      {/* Frame Info Row */}
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          width: '100%',
                          fontSize: '0.72rem',
                          fontFamily: 'monospace',
                        }}
                      >
                        <span style={{ color: isViewing ? '#e2b714' : '#aaa', fontWeight: isViewing ? 800 : 500 }}>
                          #{String(idx + 1).padStart(2, '0')}
                        </span>
                        {isSelected ? (
                          <span style={{ color: '#00ff88', fontWeight: 800, fontSize: '0.66rem' }}>✓ LOOP</span>
                        ) : (
                          <span style={{ color: '#555566', fontSize: '0.64rem' }}>SKIP</span>
                        )}
                      </div>

                      {/* Start / End Mini Badges */}
                      <div style={{ position: 'absolute', top: 5, left: 5, display: 'flex', gap: 2 }}>
                        {isStart && (
                          <span style={{ background: '#00ff88', color: '#000', fontSize: '0.55rem', fontWeight: 800, padding: '1px 4px', borderRadius: 2 }}>
                            START
                          </span>
                        )}
                        {isEnd && (
                          <span style={{ background: '#ff3344', color: '#fff', fontSize: '0.55rem', fontWeight: 800, padding: '1px 4px', borderRadius: 2 }}>
                            END
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Deck 2: Loop Selection & Distribution Toolbar */}
        <div
          style={{
            background: '#13131f',
            borderRadius: 8,
            padding: '0.85rem 1.25rem',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          {/* Cluster 1: Range & Distribution */}
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.65rem' }}>
            <button
              onClick={() => setStartIndex(currentIndex)}
              style={{
                background: isCurrentStart ? '#00ff88' : '#222232',
                color: isCurrentStart ? '#000' : '#fff',
                fontWeight: 700,
                border: isCurrentStart ? '1px solid #00ff88' : '1px solid rgba(255, 255, 255, 0.18)',
                borderRadius: 5,
                padding: '0.45rem 0.85rem',
                fontSize: '0.78rem',
                cursor: 'pointer',
              }}
            >
              Set Start {startIndex !== null ? `(${startIndex + 1})` : ''}
            </button>

            <button
              onClick={() => setEndIndex(currentIndex)}
              style={{
                background: isCurrentEnd ? '#ff3344' : '#222232',
                color: '#fff',
                fontWeight: 700,
                border: isCurrentEnd ? '1px solid #ff3344' : '1px solid rgba(255, 255, 255, 0.18)',
                borderRadius: 5,
                padding: '0.45rem 0.85rem',
                fontSize: '0.78rem',
                cursor: 'pointer',
              }}
            >
              Set End {endIndex !== null ? `(${endIndex + 1})` : ''}
            </button>

            {/* N Frames input */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                background: '#0d0d16',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: 5,
                padding: '0.25rem 0.5rem',
              }}
            >
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#888' }}>Frames (N):</span>
              <input
                type="number"
                min={2}
                max={64}
                value={targetCount}
                onChange={(e) => setTargetCount(Math.max(2, Number(e.target.value)))}
                style={{
                  width: 44,
                  background: 'transparent',
                  border: 'none',
                  color: '#00ff88',
                  fontFamily: 'monospace',
                  fontWeight: 800,
                  fontSize: '0.85rem',
                  textAlign: 'center',
                  outline: 'none',
                }}
              />
            </div>

            <button
              onClick={handleDistributeClick}
              style={{
                background: '#0088ff',
                color: '#fff',
                fontWeight: 700,
                border: 'none',
                borderRadius: 5,
                padding: '0.45rem 0.95rem',
                fontSize: '0.78rem',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0, 136, 255, 0.3)',
              }}
              title="Evenly select N frames between Start and End points"
            >
              Distribute Evenly
            </button>

            <button
              onClick={handleToggleCurrent}
              style={{
                background: isCurrentSelected ? 'rgba(0, 255, 136, 0.15)' : '#222232',
                border: isCurrentSelected ? '1px solid #00ff88' : '1px solid rgba(255, 255, 255, 0.18)',
                borderRadius: 5,
                color: isCurrentSelected ? '#00ff88' : '#fff',
                padding: '0.45rem 0.85rem',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {isCurrentSelected ? '✓ Selected' : '+ Toggle Frame'}
            </button>

            <button
              onClick={handleClearSelected}
              style={{
                background: '#222232',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: 5,
                color: '#ff6677',
                padding: '0.45rem 0.75rem',
                fontSize: '0.78rem',
                cursor: 'pointer',
              }}
            >
              Clear
            </button>
          </div>

          {/* Selection Status readout */}
          <div
            style={{
              fontSize: '0.78rem',
              color: '#8888bb',
              fontFamily: 'monospace',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <span>Current: frame-{String(currentIndex + 1).padStart(4, '0')}.png</span>
            <span>•</span>
            <span
              style={{
                background: 'rgba(0, 255, 136, 0.12)',
                color: '#00ff88',
                padding: '2px 8px',
                borderRadius: 4,
                fontWeight: 700,
                border: '1px solid rgba(0, 255, 136, 0.25)',
              }}
            >
              {selectedIndices.size} Frames Selected
            </span>
          </div>
        </div>

        {/* Deck 3: Export & Studio Bridge Deck */}
        <div
          style={{
            background: 'linear-gradient(180deg, #161626 0%, #10101a 100%)',
            borderRadius: 8,
            padding: '1rem 1.25rem',
            border: '1px solid rgba(0, 136, 255, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          {/* Target Size Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '0.8rem', color: '#aaa', fontWeight: 600 }}>Export Resolution:</span>
            <div style={{ display: 'flex', gap: '0.35rem' }}>
              {[256, 512, 1024].map((sz) => (
                <button
                  key={sz}
                  onClick={() => setExportSize(sz as any)}
                  style={{
                    padding: '0.35rem 0.75rem',
                    borderRadius: 4,
                    background: exportSize === sz ? '#0088ff' : '#222232',
                    border: exportSize === sz ? '1px solid #33aaff' : '1px solid rgba(255, 255, 255, 0.12)',
                    color: '#fff',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {sz}px
                </button>
              ))}
            </div>
            <span style={{ fontSize: '0.75rem', color: '#666688', marginLeft: '0.5rem' }}>
              Includes ground padding & jump headroom
            </span>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.65rem' }}>
            <button
              onClick={handleExportIndividualPngs}
              style={{
                background: '#222232',
                border: '1px solid rgba(255, 255, 255, 0.18)',
                borderRadius: 6,
                color: '#fff',
                padding: '0.5rem 0.85rem',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              <DownloadIcon size={14} />
              Save Individual PNGs
            </button>

            <button
              onClick={handleExportSelectedSpritesheet}
              style={{
                background: '#222232',
                border: '1px solid rgba(255, 255, 255, 0.22)',
                borderRadius: 6,
                color: '#fff',
                fontWeight: 600,
                padding: '0.5rem 0.95rem',
                fontSize: '0.8rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
              title="Export sprite sheet directly with standard padding & config"
            >
              <DownloadIcon size={14} />
              Save Sprite Sheet
            </button>

            <button
              onClick={handleSendToSpriteStudio}
              style={{
                background: 'linear-gradient(135deg, #0088ff 0%, #00cc88 100%)',
                border: 'none',
                borderRadius: 6,
                color: '#000',
                fontWeight: 800,
                padding: '0.55rem 1.15rem',
                fontSize: '0.82rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                boxShadow: '0 4px 14px rgba(0, 204, 136, 0.4)',
                letterSpacing: '0.02em',
              }}
              title="Send selected frames to Sprite Studio for full visual padding alignment, scale adjustment, and jump headroom setup"
            >
              <SparkleIcon size={16} weight="fill" color="#000" />
              Send to Sprite Studio (Pad & Scale)
            </button>
          </div>
        </div>
      </div>


    </div>
  );
};
