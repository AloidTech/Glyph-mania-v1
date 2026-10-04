import React, { useState, useEffect, useRef } from 'react';
import {
  X as XIcon,
  Check as CheckIcon,
  Sparkle as SparkleIcon,
  Sliders as SlidersIcon,
  ArrowCounterClockwise as ResetIcon,
  Crop as CropIcon,
} from '@phosphor-icons/react';
import { removeImageBackground, BackgroundRemovalOptions } from '../../lib/admin_utils/background_remover';

export interface BackgroundRemoverModalProps {
  isOpen: boolean;
  imageSrc: string | null;
  onClose: () => void;
  onApply: (processedDataUrl: string) => void;
  title?: string;
}

export const BackgroundRemoverModal: React.FC<BackgroundRemoverModalProps> = ({
  isOpen,
  imageSrc,
  onClose,
  onApply,
  title = 'Arcane Asset Background Remover',
}) => {
  const [tolerance, setTolerance] = useState<number>(28);
  const [feather, setFeather] = useState<number>(14);
  const [contiguousOnly, setContiguousOnly] = useState<boolean>(false);
  const [autoTrim, setAutoTrim] = useState<boolean>(true);
  const [previewBg, setPreviewBg] = useState<'parchment' | 'checker' | 'dark' | 'white'>('parchment');
  const [showOriginal, setShowOriginal] = useState<boolean>(false);
  const [processedUrl, setProcessedUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Debounce processing to keep slider smooth
  const processTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isOpen || !imageSrc) {
      setProcessedUrl(null);
      return;
    }

    if (processTimeoutRef.current) {
      clearTimeout(processTimeoutRef.current);
    }

    setIsProcessing(true);
    processTimeoutRef.current = window.setTimeout(async () => {
      try {
        const options: BackgroundRemovalOptions = {
          tolerance,
          feather,
          contiguousOnly,
          autoTrim,
          removeHalo: true,
          trimPadding: 18,
        };
        const result = await removeImageBackground(imageSrc, options);
        setProcessedUrl(result);
      } catch (err) {
        console.error('Failed to process image background:', err);
      } finally {
        setIsProcessing(false);
      }
    }, 60);

    return () => {
      if (processTimeoutRef.current) {
        clearTimeout(processTimeoutRef.current);
      }
    };
  }, [isOpen, imageSrc, tolerance, feather, contiguousOnly, autoTrim]);

  if (!isOpen || !imageSrc) return null;

  const handleApply = () => {
    if (processedUrl) {
      onApply(processedUrl);
    } else {
      onApply(imageSrc);
    }
  };

  const handleReset = () => {
    setTolerance(28);
    setFeather(14);
    setContiguousOnly(false);
    setAutoTrim(true);
  };

  const getStageBgStyle = (): React.CSSProperties => {
    switch (previewBg) {
      case 'parchment':
        return {
          backgroundColor: '#fbf9f4',
          backgroundImage: 'radial-gradient(#e8e3d8 1px, transparent 1px)',
          backgroundSize: '16px 16px',
        };
      case 'dark':
        return {
          backgroundColor: '#18171d',
          color: '#ffffff',
        };
      case 'white':
        return {
          backgroundColor: '#ffffff',
        };
      case 'checker':
      default:
        return {
          backgroundColor: '#ffffff',
          backgroundImage:
            'linear-gradient(45deg, #f0ede6 25%, transparent 25%), linear-gradient(-45deg, #f0ede6 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #f0ede6 75%), linear-gradient(-45deg, transparent 75%, #f0ede6 75%)',
          backgroundSize: '16px 16px',
          backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
        };
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(26, 22, 20, 0.65)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '1rem',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: '680px',
          maxWidth: '96vw',
          maxHeight: '92vh',
          backgroundColor: 'var(--admin-paper, #ffffff)',
          borderRadius: '14px',
          boxShadow: '0 16px 40px rgba(0, 0, 0, 0.22), 0 0 0 1px rgba(0, 0, 0, 0.08)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '1rem 1.4rem',
            borderBottom: '1px solid var(--admin-border, #ede8df)',
            background: 'var(--admin-paper-warm, #fbf9f4)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '8px',
                background: 'var(--color-accent-muted, #fef3c7)',
                color: 'var(--admin-accent, #c59b27)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <SparkleIcon size={18} weight="fill" />
            </div>
            <div>
              <h3
                style={{
                  margin: 0,
                  fontFamily: 'var(--font-heading)',
                  fontSize: '1.05rem',
                  fontWeight: 700,
                  color: 'var(--admin-ink, #1a1614)',
                }}
              >
                {title}
              </h3>
              <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--admin-ink-muted, #64748b)' }}>
                Clean transparency extraction with smooth halo suppression & auto-trim
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--admin-ink-muted, #64748b)',
              padding: '6px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            aria-label="Close modal"
          >
            <XIcon size={18} weight="bold" />
          </button>
        </div>

        {/* Modal Body */}
        <div
          style={{
            padding: '1.25rem 1.4rem',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.15rem',
          }}
        >
          {/* Interactive Preview Canvas Box */}
          <div
            style={{
              position: 'relative',
              width: '100%',
              height: '240px',
              borderRadius: '10px',
              border: '1.5px solid var(--admin-border, #ede8df)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              transition: 'background-color 0.2s ease',
              ...getStageBgStyle(),
            }}
          >
            {/* Image Preview */}
            <img
              src={showOriginal ? imageSrc : processedUrl || imageSrc}
              alt="Background removal preview"
              style={{
                maxWidth: '85%',
                maxHeight: '85%',
                objectFit: 'contain',
                filter: previewBg === 'dark' ? 'drop-shadow(0 2px 8px rgba(255, 255, 255, 0.1))' : 'none',
              }}
            />

            {/* Stage Preview Mode Tabs (Top Right) */}
            <div
              style={{
                position: 'absolute',
                top: 8,
                right: 8,
                display: 'flex',
                gap: 4,
                background: 'rgba(255, 255, 255, 0.85)',
                backdropFilter: 'blur(6px)',
                padding: 3,
                borderRadius: '6px',
                border: '1px solid rgba(0, 0, 0, 0.1)',
                zIndex: 5,
              }}
            >
              {(['parchment', 'checker', 'dark', 'white'] as const).map((bgMode) => (
                <button
                  key={bgMode}
                  type="button"
                  onClick={() => setPreviewBg(bgMode)}
                  style={{
                    padding: '2px 7px',
                    fontSize: '0.68rem',
                    fontFamily: 'inherit',
                    fontWeight: 600,
                    textTransform: 'capitalize',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    background: previewBg === bgMode ? '#1a1614' : 'transparent',
                    color: previewBg === bgMode ? '#ffffff' : '#59524c',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {bgMode}
                </button>
              ))}
            </div>

            {/* Hold to compare button (Top Left) */}
            <button
              type="button"
              onMouseDown={() => setShowOriginal(true)}
              onMouseUp={() => setShowOriginal(false)}
              onMouseLeave={() => setShowOriginal(false)}
              onTouchStart={() => setShowOriginal(true)}
              onTouchEnd={() => setShowOriginal(false)}
              style={{
                position: 'absolute',
                top: 8,
                left: 8,
                padding: '3px 8px',
                fontSize: '0.7rem',
                fontWeight: 600,
                borderRadius: '5px',
                border: '1px solid rgba(0, 0, 0, 0.12)',
                background: showOriginal ? '#1a1614' : 'rgba(255, 255, 255, 0.88)',
                color: showOriginal ? '#ffffff' : '#3a3532',
                cursor: 'pointer',
                userSelect: 'none',
                zIndex: 5,
              }}
            >
              {showOriginal ? 'Showing Original' : 'Hold to View Original'}
            </button>

            {/* Processing Indicator */}
            {isProcessing && (
              <div
                style={{
                  position: 'absolute',
                  bottom: 8,
                  left: 8,
                  fontSize: '0.7rem',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  background: 'rgba(0, 0, 0, 0.7)',
                  color: '#ffffff',
                }}
              >
                Extracting alpha…
              </div>
            )}
          </div>

          {/* Slider & Filter Controls */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.85rem',
              background: 'var(--admin-paper-warm, #fbf9f4)',
              border: '1px solid var(--admin-border, #ede8df)',
              borderRadius: '8px',
              padding: '0.9rem 1.1rem',
            }}
          >
            {/* Tolerance Slider */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <label
                  style={{
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    color: 'var(--admin-ink, #1a1614)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                  }}
                >
                  <SlidersIcon size={14} /> Sensitivity Threshold
                </label>
                <span style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--admin-accent, #c59b27)' }}>
                  {tolerance}%
                </span>
              </div>
              <input
                type="range"
                min={5}
                max={70}
                value={tolerance}
                onChange={(e) => setTolerance(Number(e.target.value))}
                style={{
                  width: '100%',
                  accentColor: 'var(--admin-accent, #c59b27)',
                  cursor: 'pointer',
                }}
              />
              <div style={{ fontSize: '0.68rem', color: 'var(--admin-ink-muted, #64748b)', marginTop: 2 }}>
                Higher sensitivity cleans lighter paper shadows; lower preserves faint pencil/ink details.
              </div>
            </div>

            {/* Edge Feathering Slider */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <label
                  style={{
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    color: 'var(--admin-ink, #1a1614)',
                  }}
                >
                  Edge Softness (Feathering)
                </label>
                <span style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--admin-accent, #c59b27)' }}>
                  {feather}px
                </span>
              </div>
              <input
                type="range"
                min={2}
                max={30}
                value={feather}
                onChange={(e) => setFeather(Number(e.target.value))}
                style={{
                  width: '100%',
                  accentColor: 'var(--admin-accent, #c59b27)',
                  cursor: 'pointer',
                }}
              />
            </div>

            {/* Toggles */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', paddingTop: '0.25rem' }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={autoTrim}
                  onChange={(e) => setAutoTrim(e.target.checked)}
                  style={{ accentColor: 'var(--admin-accent, #c59b27)' }}
                />
                <span style={{ fontWeight: 600, color: 'var(--admin-ink, #1a1614)' }}>
                  Auto-Trim Empty Borders
                </span>
              </label>

              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={contiguousOnly}
                  onChange={(e) => setContiguousOnly(e.target.checked)}
                  style={{ accentColor: 'var(--admin-accent, #c59b27)' }}
                />
                <span style={{ fontWeight: 600, color: 'var(--admin-ink, #1a1614)' }}>
                  Boundary Flood-Fill Only (Preserves inner white loops)
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.85rem 1.4rem',
            borderTop: '1px solid var(--admin-border, #ede8df)',
            background: 'var(--admin-paper-warm, #fbf9f4)',
          }}
        >
          <button
            type="button"
            onClick={handleReset}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.76rem',
              fontWeight: 600,
              color: 'var(--admin-ink-muted, #64748b)',
            }}
          >
            <ResetIcon size={14} /> Reset Defaults
          </button>

          <div style={{ display: 'flex', gap: '0.65rem' }}>
            <button
              type="button"
              onClick={onClose}
              className="admin-btn admin-btn-secondary"
              style={{ padding: '0.45rem 1rem', fontSize: '0.78rem' }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="admin-btn admin-btn-primary"
              style={{
                padding: '0.45rem 1.25rem',
                fontSize: '0.78rem',
                background: 'var(--admin-accent, #c59b27)',
                color: '#ffffff',
                border: 'none',
              }}
            >
              <CheckIcon size={14} weight="bold" /> Use Transparent Asset
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
