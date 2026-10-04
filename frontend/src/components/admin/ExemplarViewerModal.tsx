import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  XIcon,
  CaretLeftIcon,
  CaretRightIcon,
  TrashIcon,
  DownloadSimpleIcon,
  SparkleIcon,
  EyeIcon,
} from '@phosphor-icons/react';
import toast from 'react-hot-toast';
import { TrainingExample } from '../../lib/ml/training_store';

interface ExemplarViewerModalProps {
  isOpen: boolean;
  examples: TrainingExample[];
  initialIndex?: number;
  sigilLabel: string;
  sigilId: string;
  onClose: () => void;
  onDelete: (exampleId: string) => void;
}

export const ExemplarViewerModal: React.FC<ExemplarViewerModalProps> = ({
  isOpen,
  examples,
  initialIndex = 0,
  sigilLabel,
  sigilId,
  onClose,
  onDelete,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [zoomMode, setZoomMode] = useState<'fit' | 'crisp'>('crisp');
  const filmstripRef = useRef<HTMLDivElement>(null);

  // Synchronize index when opening or when example count changes
  useEffect(() => {
    if (isOpen) {
      const validIndex = Math.min(
        Math.max(0, initialIndex),
        Math.max(0, examples.length - 1)
      );
      setCurrentIndex(validIndex);
      setShowDeleteConfirm(false);
    }
  }, [isOpen, initialIndex, examples.length]);

  // Ensure currentIndex stays within bounds if an example gets removed
  useEffect(() => {
    if (examples.length > 0 && currentIndex >= examples.length) {
      setCurrentIndex(examples.length - 1);
    }
  }, [examples.length, currentIndex]);

  // Auto-scroll the thumbnail filmstrip so active item stays centered
  useEffect(() => {
    if (!isOpen) return;
    const activeThumb = filmstripRef.current?.children[currentIndex] as
      | HTMLElement
      | undefined;
    if (activeThumb) {
      activeThumb.scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest',
      });
    }
  }, [currentIndex, isOpen]);

  const handlePrev = useCallback(() => {
    setShowDeleteConfirm(false);
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : examples.length - 1));
  }, [examples.length]);

  const handleNext = useCallback(() => {
    setShowDeleteConfirm(false);
    setCurrentIndex((prev) => (prev < examples.length - 1 ? prev + 1 : 0));
  }, [examples.length]);

  // Keyboard navigation (Arrow keys, Escape)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is focused inside an input/textarea
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrev();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handlePrev, handleNext, onClose]);

  if (!isOpen || examples.length === 0) return null;

  const currentExample = examples[currentIndex] || examples[0];
  if (!currentExample) return null;

  // Download handler for current exemplar
  const handleDownload = () => {
    try {
      const a = document.createElement('a');
      a.href = currentExample.thumb;
      const cleanSigil = sigilLabel.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
      const timestamp = currentExample.createdAt
        ? new Date(currentExample.createdAt).toISOString().slice(0, 10)
        : 'exemplar';
      a.download = `${cleanSigil}_exemplar_${currentIndex + 1}_${timestamp}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success(`Downloaded exemplar #${currentIndex + 1}`);
    } catch (err) {
      toast.error('Failed to download exemplar image');
    }
  };

  // Delete handler with safety
  const handleConfirmDelete = () => {
    const targetId = currentExample.id;
    const targetIdx = currentIndex;
    setShowDeleteConfirm(false);

    onDelete(targetId);
    toast.success(`Deleted exemplar #${targetIdx + 1}`);

    if (examples.length <= 1) {
      onClose();
    } else if (targetIdx >= examples.length - 1) {
      setCurrentIndex(Math.max(0, examples.length - 2));
    }
  };

  const formattedDate = currentExample.createdAt
    ? new Date(currentExample.createdAt).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : null;

  return (
    <div
      className="modal-overlay exemplar-modal-overlay"
      onClick={onClose}
      style={{
        zIndex: 150,
        position: 'fixed',
        inset: 0,
        background: 'rgba(12, 10, 8, 0.82)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        boxSizing: 'border-box',
      }}
    >
      <div
        className="exemplar-modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '680px',
          background: 'var(--admin-paper, #ffffff)',
          border: '1px solid var(--admin-border-strong, #c8c0b2)',
          borderRadius: '16px',
          boxShadow: 'var(--admin-modal-shadow, 0 24px 60px rgba(0, 0, 0, 0.35))',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'exemplarModalIn 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* ── Modal Header ── */}
        <div
          style={{
            padding: '1rem 1.35rem',
            borderBottom: '1px solid var(--admin-border, #e2dcd2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            background: 'var(--admin-paper-warm, #faf8f3)',
          }}
        >
          {/* Left Title & Sigil Tag */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '8px',
                background: 'var(--admin-paper, #ffffff)',
                border: '1px solid var(--admin-border, #e2dcd2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--admin-accent, #c9a227)',
              }}
            >
              <SparkleIcon size={18} weight="fill" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h3
                  style={{
                    margin: 0,
                    fontFamily: 'var(--font-heading, serif)',
                    fontSize: '1.05rem',
                    color: 'var(--admin-ink, #1b1f23)',
                  }}
                >
                  {sigilLabel}
                </h3>
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    padding: '0.15rem 0.55rem',
                    borderRadius: '999px',
                    background: 'var(--admin-accent-subtle, rgba(201, 162, 39, 0.15))',
                    color: 'var(--admin-ink, #1b1f23)',
                    border: '1px solid var(--admin-accent-border-subtle, rgba(201, 162, 39, 0.3))',
                  }}
                >
                  Exemplar {currentIndex + 1} of {examples.length}
                </span>
              </div>
              {formattedDate && (
                <div
                  style={{
                    fontSize: '0.725rem',
                    color: 'var(--admin-ink-muted, #718096)',
                    marginTop: '0.15rem',
                  }}
                >
                  Recorded: {formattedDate}
                </div>
              )}

              {/* Model Training Lineage Indicators */}
              {currentExample.firstModelTrainedId ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.35rem' }}>
                  <span
                    style={{
                      fontSize: '0.68rem',
                      padding: '0.12rem 0.45rem',
                      borderRadius: 6,
                      background: 'rgba(34, 197, 94, 0.12)',
                      color: '#15803d',
                      fontWeight: 600,
                      border: '1px solid rgba(34, 197, 94, 0.25)',
                    }}
                    title={`First model trained with this exemplar: ${currentExample.firstModelTrainedId}`}
                  >
                    First Model: {currentExample.firstModelTrainedId.length > 16 ? currentExample.firstModelTrainedId.slice(0, 16) + '…' : currentExample.firstModelTrainedId}
                  </span>
                  <span
                    style={{
                      fontSize: '0.68rem',
                      padding: '0.12rem 0.45rem',
                      borderRadius: 6,
                      background: 'rgba(59, 130, 246, 0.12)',
                      color: '#1d4ed8',
                      fontWeight: 600,
                      border: '1px solid rgba(59, 130, 246, 0.25)',
                    }}
                    title={`Last model trained with this exemplar: ${currentExample.lastModelTrainedId}`}
                  >
                    Last Model: {currentExample.lastModelTrainedId && currentExample.lastModelTrainedId.length > 16 ? currentExample.lastModelTrainedId.slice(0, 16) + '…' : currentExample.lastModelTrainedId}
                  </span>
                </div>
              ) : (
                <div style={{ marginTop: '0.35rem' }}>
                  <span
                    style={{
                      fontSize: '0.68rem',
                      padding: '0.12rem 0.45rem',
                      borderRadius: 6,
                      background: 'var(--admin-paper-muted)',
                      color: 'var(--admin-ink-muted)',
                      border: '1px solid var(--admin-border)',
                    }}
                  >
                    Not yet trained in any saved model
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Right Action Icons: Download, Delete, Close */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={handleDownload}
              className="admin-btn admin-btn-ghost"
              style={{
                padding: '0.4rem 0.75rem',
                fontSize: '0.8rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
              title="Download this exemplar image (PNG)"
            >
              <DownloadSimpleIcon size={16} weight="bold" />
              <span>Download</span>
            </button>

            {showDeleteConfirm ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  background: 'var(--admin-danger-paper, #fff5f5)',
                  border: '1px solid var(--admin-danger-border, #feb2b2)',
                  borderRadius: '8px',
                  padding: '0.2rem 0.4rem',
                }}
              >
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: 'var(--admin-danger, #c53030)',
                  }}
                >
                  Delete?
                </span>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="admin-btn admin-btn-danger"
                  style={{ padding: '0.25rem 0.55rem', fontSize: '0.75rem' }}
                >
                  Yes
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="admin-btn admin-btn-ghost"
                  style={{ padding: '0.25rem 0.45rem', fontSize: '0.75rem' }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="admin-btn admin-btn-danger"
                style={{
                  padding: '0.4rem 0.75rem',
                  fontSize: '0.8rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                }}
                title="Delete this exemplar"
              >
                <TrashIcon size={16} />
                <span>Delete</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="admin-btn admin-btn-ghost"
              style={{
                padding: '0.4rem',
                borderRadius: '8px',
                color: 'var(--admin-ink-muted, #718096)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="Close (Esc)"
              aria-label="Close"
            >
              <XIcon size={18} weight="bold" />
            </button>
          </div>
        </div>

        {/* ── Main Stage with Navigation Arrows ── */}
        <div
          style={{
            position: 'relative',
            padding: '1.75rem 1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--admin-paper, #ffffff)',
          }}
        >
          {/* Left Arrow Button */}
          <button
            type="button"
            onClick={handlePrev}
            aria-label="Previous exemplar"
            title="Previous exemplar (Left arrow)"
            style={{
              position: 'absolute',
              left: '1.25rem',
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: 'var(--admin-paper-warm, #faf8f3)',
              border: '1px solid var(--admin-border, #e2dcd2)',
              color: 'var(--admin-ink, #1b1f23)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
              transition: 'all 0.15s ease',
              zIndex: 10,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.08)';
              e.currentTarget.style.borderColor = 'var(--admin-accent, #c9a227)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.borderColor = 'var(--admin-border, #e2dcd2)';
            }}
          >
            <CaretLeftIcon size={22} weight="bold" />
          </button>

          {/* Central Artwork Canvas Box */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.85rem',
            }}
          >
            <div
              style={{
                width: '320px',
                height: '320px',
                maxWidth: '75vw',
                maxHeight: '75vw',
                background: '#ffffff',
                borderRadius: '16px',
                border: '2px solid var(--admin-border-strong, #c8c0b2)',
                boxShadow:
                  '0 12px 32px rgba(0,0,0,0.08), inset 0 2px 6px rgba(0,0,0,0.04)',
                overflow: 'hidden',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '12px',
                boxSizing: 'border-box',
              }}
            >
              <img
                src={currentExample.thumb}
                alt={`Exemplar #${currentIndex + 1} for ${sigilLabel}`}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  display: 'block',
                  imageRendering: zoomMode === 'crisp' ? 'pixelated' : 'auto',
                }}
              />

              {/* Rendering Mode Toggle Pill inside bottom-right */}
              <button
                type="button"
                onClick={() => setZoomMode((prev) => (prev === 'crisp' ? 'fit' : 'crisp'))}
                title={
                  zoomMode === 'crisp'
                    ? 'Current: Crisp pixelated. Click for smooth rendering.'
                    : 'Current: Smooth. Click for crisp pixelated.'
                }
                style={{
                  position: 'absolute',
                  bottom: '10px',
                  right: '10px',
                  background: 'rgba(255, 255, 255, 0.92)',
                  border: '1px solid var(--admin-border, #e2dcd2)',
                  borderRadius: '6px',
                  padding: '2px 8px',
                  fontSize: '0.68rem',
                  fontWeight: 600,
                  color: 'var(--admin-ink-secondary, #4a5568)',
                  cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
                }}
              >
                {zoomMode === 'crisp' ? 'Crisp (1x)' : 'Smooth'}
              </button>
            </div>

            {/* Quick Metadata Badges */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.85rem',
                fontSize: '0.75rem',
                color: 'var(--admin-ink-muted, #718096)',
              }}
            >
              <span>512-dim embedding vector</span>
              <span>•</span>
              <span>ID: <code style={{ fontFamily: 'var(--font-mono)' }}>{currentExample.id.slice(0, 8)}</code></span>
            </div>
          </div>

          {/* Right Arrow Button */}
          <button
            type="button"
            onClick={handleNext}
            aria-label="Next exemplar"
            title="Next exemplar (Right arrow)"
            style={{
              position: 'absolute',
              right: '1.25rem',
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: 'var(--admin-paper-warm, #faf8f3)',
              border: '1px solid var(--admin-border, #e2dcd2)',
              color: 'var(--admin-ink, #1b1f23)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
              transition: 'all 0.15s ease',
              zIndex: 10,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.08)';
              e.currentTarget.style.borderColor = 'var(--admin-accent, #c9a227)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.borderColor = 'var(--admin-border, #e2dcd2)';
            }}
          >
            <CaretRightIcon size={22} weight="bold" />
          </button>
        </div>

        {/* ── Interactive Slider & Filmstrip Scrubber ── */}
        <div
          style={{
            padding: '0.85rem 1.25rem 1.15rem',
            background: 'var(--admin-paper-warm, #faf8f3)',
            borderTop: '1px solid var(--admin-border, #e2dcd2)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
          }}
        >
          {/* Quick Slider Range bar */}
          {examples.length > 1 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                fontSize: '0.75rem',
                color: 'var(--admin-ink-muted, #718096)',
              }}
            >
              <span>1</span>
              <input
                type="range"
                min={0}
                max={examples.length - 1}
                value={currentIndex}
                onChange={(e) => {
                  setShowDeleteConfirm(false);
                  setCurrentIndex(Number(e.target.value));
                }}
                style={{
                  flex: 1,
                  accentColor: 'var(--admin-accent, #c9a227)',
                  cursor: 'pointer',
                }}
              />
              <span>{examples.length}</span>
            </div>
          )}

          {/* Thumbnail Strip */}
          <div
            ref={filmstripRef}
            className="scroll-inner"
            style={{
              display: 'flex',
              gap: '0.5rem',
              overflowX: 'auto',
              padding: '4px 2px',
              scrollbarWidth: 'thin',
            }}
          >
            {examples.map((ex, idx) => {
              const isActive = idx === currentIndex;
              return (
                <div
                  key={ex.id}
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setCurrentIndex(idx);
                  }}
                  title={`Jump to exemplar #${idx + 1}`}
                  style={{
                    flexShrink: 0,
                    width: 52,
                    height: 52,
                    borderRadius: '8px',
                    border: isActive
                      ? '2px solid var(--admin-accent, #c9a227)'
                      : '1px solid var(--admin-border, #e2dcd2)',
                    boxShadow: isActive
                      ? '0 0 0 2px var(--admin-accent-subtle, rgba(201, 162, 39, 0.3)), 0 4px 10px rgba(0,0,0,0.1)'
                      : '0 1px 3px rgba(0,0,0,0.05)',
                    transform: isActive ? 'scale(1.06)' : 'scale(1)',
                    transition: 'all 0.18s ease',
                    cursor: 'pointer',
                    background: '#ffffff',
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <img
                    src={ex.thumb}
                    alt={`Thumb #${idx + 1}`}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain',
                      display: 'block',
                    }}
                  />
                </div>
              );
            })}
          </div>

          {/* Key shortcut hint */}
          <div
            style={{
              textAlign: 'center',
              fontSize: '0.725rem',
              color: 'var(--admin-ink-muted, #718096)',
            }}
          >
            Navigate with <kbd style={{ padding: '1px 5px', borderRadius: 4, background: 'var(--admin-paper)', border: '1px solid var(--admin-border)' }}>←</kbd>{' '}
            <kbd style={{ padding: '1px 5px', borderRadius: 4, background: 'var(--admin-paper)', border: '1px solid var(--admin-border)' }}>→</kbd>{' '}
            or use the slider • <kbd style={{ padding: '1px 5px', borderRadius: 4, background: 'var(--admin-paper)', border: '1px solid var(--admin-border)' }}>Esc</kbd> to close
          </div>
        </div>
      </div>
    </div>
  );
};
