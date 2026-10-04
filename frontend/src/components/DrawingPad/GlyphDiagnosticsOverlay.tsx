import React from 'react';
import {
  WarningCircleIcon,
  InfoIcon,
  SparkleIcon,
  XIcon,
  ArrowsOutCardinalIcon,
} from '@phosphor-icons/react';
import type { CanvasSigilError } from '../../lib/glyph_helpers/glyph_solidity';

export interface GlyphDiagnosticsOverlayProps {
  errors: CanvasSigilError[];
  canvasElement?: HTMLCanvasElement | null;
  canvasWidth?: number;
  canvasHeight?: number;
  dismissedErrors?: Record<string, boolean>;
  onDismissError?: (errorKey: string) => void;
  onSelectError?: (error: CanvasSigilError) => void;
  sessionId?: string | number;
}

export const GlyphDiagnosticsOverlay: React.FC<GlyphDiagnosticsOverlayProps> = ({
  errors,
  canvasElement,
  canvasWidth: propWidth,
  canvasHeight: propHeight,
  dismissedErrors = {},
  onDismissError,
  onSelectError,
  sessionId = 'diag',
}) => {
  if (!errors || errors.length === 0) return null;

  const width = propWidth || canvasElement?.width || 500;
  const height = propHeight || canvasElement?.height || 500;

  return (
    <>
      {/* 1. SVG Error Bounding Boxes Overlay (dashed border on faulty sigil areas) */}
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 3,
        }}
      >
        {errors.map((item, idx) => {
          if (dismissedErrors[item.key]) return null;
          const pad = 6;
          const x = Math.max(0, item.bbox.x - pad);
          const y = Math.max(0, item.bbox.y - pad);
          const w = item.bbox.width + pad * 2;
          const h = item.bbox.height + pad * 2;

          let strokeColor = 'var(--admin-bubble-border-error, #ef4444)';
          let fillColor = 'rgba(239, 68, 68, 0.04)';
          if (item.errorType === 'missing') {
            strokeColor = '#f59e0b';
            fillColor = 'rgba(245, 158, 11, 0.04)';
          } else if (item.errorType === 'cardinal_too_short') {
            strokeColor = '#f97316';
            fillColor = 'rgba(249, 115, 22, 0.08)';
          } else if (item.errorType === 'low_accuracy') {
            strokeColor = '#6366f1';
            fillColor = 'rgba(99, 102, 241, 0.04)';
          }

          return (
            <rect
              key={`${item.key}-bbox-${idx}`}
              x={x}
              y={y}
              width={w}
              height={h}
              fill={fillColor}
              stroke={strokeColor}
              strokeWidth="1.6"
              strokeDasharray="5 4"
              rx="8"
              ry="8"
            />
          );
        })}
      </svg>

      {/* 2. Directional Suggestion Speech Bubbles */}
      {errors.map((item) => {
        if (dismissedErrors[item.key]) return null;

        const leftPct = (item.bbox.x / width) * 100;
        const topPct = (item.bbox.y / height) * 100;
        const widthPct = (item.bbox.width / width) * 100;
        const heightPct = (item.bbox.height / height) * 100;

        const centerX = leftPct + widthPct / 2;
        const centerY = topPct + heightPct / 2;

        let side: 'right' | 'left' | 'top' | 'bottom' = 'right';
        const posStyle: React.CSSProperties = {};

        // Explicit directional outward projection for canonical slots & form augmentors
        if (item.key === 'topLeft') {
          // NORTHWEST FORM -> project OUTWARD to the WEST (LEFT)
          side = 'left';
          posStyle.right = `calc(${Math.min(92, 100 - leftPct)}% + 14px)`;
          posStyle.top = `calc(${Math.max(4, topPct - 6)}%)`;
        } else if (item.key === 'topRight') {
          // NORTHEAST FORM -> project OUTWARD to the EAST (RIGHT)
          side = 'right';
          posStyle.left = `calc(${Math.min(92, leftPct + widthPct)}% + 14px)`;
          posStyle.top = `calc(${Math.max(4, topPct - 6)}%)`;
        } else if (item.key === 'bottomLeft') {
          // SOUTHWEST FORM -> project OUTWARD to the WEST (LEFT)
          side = 'left';
          posStyle.right = `calc(${Math.min(92, 100 - leftPct)}% + 14px)`;
          posStyle.top = `calc(${Math.min(84, topPct - 4)}%)`;
        } else if (item.key === 'bottomRight') {
          // SOUTHEAST FORM -> project OUTWARD to the EAST (RIGHT)
          side = 'right';
          posStyle.left = `calc(${Math.min(92, leftPct + widthPct)}% + 14px)`;
          posStyle.top = `calc(${Math.min(84, topPct - 4)}%)`;
        } else if (item.key === 'top') {
          // NORTH ANCHOR -> project OUTWARD to the TOP
          side = 'top';
          posStyle.bottom = `calc(${Math.min(92, 100 - topPct)}% + 14px)`;
          posStyle.left = `calc(${Math.max(10, Math.min(70, centerX))}% - 30px)`;
        } else if (item.key === 'bottom') {
          // SOUTH ANCHOR -> project OUTWARD to the BOTTOM
          side = 'bottom';
          posStyle.top = `calc(${Math.min(92, topPct + heightPct)}% + 14px)`;
          posStyle.left = `calc(${Math.max(10, Math.min(70, centerX))}% - 30px)`;
        } else if (item.key === 'left') {
          // WEST ANCHOR -> project OUTWARD to the LEFT
          side = 'left';
          posStyle.right = `calc(${Math.min(92, 100 - leftPct)}% + 14px)`;
          posStyle.top = `calc(${Math.max(6, Math.min(80, centerY))}% - 20px)`;
        } else if (item.key === 'right') {
          // EAST ANCHOR -> project OUTWARD to the RIGHT
          side = 'right';
          posStyle.left = `calc(${Math.min(92, leftPct + widthPct)}% + 14px)`;
          posStyle.top = `calc(${Math.max(6, Math.min(80, centerY))}% - 20px)`;
        } else {
          // Centroid fallback relative to canvas center (50%, 50%)
          const dx = centerX - 50;
          const dy = centerY - 50;

          if (Math.abs(dx) > 10 && Math.abs(dy) > 10) {
            // Diagonal quadrant -> project laterally to avoid vertical collision
            if (dx < 0) {
              side = 'left';
              posStyle.right = `calc(${Math.min(92, 100 - leftPct)}% + 14px)`;
              posStyle.top = dy < 0 ? `calc(${Math.max(4, topPct - 6)}%)` : `calc(${Math.min(84, topPct - 4)}%)`;
            } else {
              side = 'right';
              posStyle.left = `calc(${Math.min(92, leftPct + widthPct)}% + 14px)`;
              posStyle.top = dy < 0 ? `calc(${Math.max(4, topPct - 6)}%)` : `calc(${Math.min(84, topPct - 4)}%)`;
            }
          } else if (Math.abs(dx) >= Math.abs(dy)) {
            if (dx < 0) {
              side = 'left';
              posStyle.right = `calc(${Math.min(92, 100 - leftPct)}% + 14px)`;
              posStyle.top = `calc(${Math.max(6, Math.min(80, centerY))}% - 20px)`;
            } else {
              side = 'right';
              posStyle.left = `calc(${Math.min(92, leftPct + widthPct)}% + 14px)`;
              posStyle.top = `calc(${Math.max(6, Math.min(80, centerY))}% - 20px)`;
            }
          } else {
            if (dy < 0) {
              side = 'top';
              posStyle.bottom = `calc(${Math.min(92, 100 - topPct)}% + 14px)`;
              posStyle.left = `calc(${Math.max(10, Math.min(70, centerX))}% - 30px)`;
            } else {
              side = 'bottom';
              posStyle.top = `calc(${Math.min(92, topPct + heightPct)}% + 14px)`;
              posStyle.left = `calc(${Math.max(10, Math.min(70, centerX))}% - 30px)`;
            }
          }
        }

        const renderIcon = () => {
          if (item.errorType === 'missing') {
            return <WarningCircleIcon size={14} weight="fill" color="#f59e0b" style={{ flexShrink: 0 }} />;
          }
          if (item.errorType === 'cardinal_too_short') {
            return <ArrowsOutCardinalIcon size={14} weight="bold" color="#f97316" style={{ flexShrink: 0 }} />;
          }
          if (item.errorType === 'type_mismatch' || item.errorType === 'form_mismatch') {
            return <WarningCircleIcon size={14} weight="fill" color="var(--admin-danger, #ef4444)" style={{ flexShrink: 0 }} />;
          }
          if (item.errorType === 'unrecognized') {
            return <InfoIcon size={14} weight="fill" color="var(--admin-accent, #3b82f6)" style={{ flexShrink: 0 }} />;
          }
          return <SparkleIcon size={13} weight="fill" color="var(--admin-accent, #3b82f6)" style={{ flexShrink: 0 }} />;
        };

        const handleDismiss = (e: React.MouseEvent) => {
          e.stopPropagation();
          onDismissError?.(item.key);
        };

        return (
          <div
            key={`${sessionId}-${item.key}`}
            className={`canvas-speech-bubble bubble-side-${side}`}
            style={posStyle}
            onClick={() => {
              if (onSelectError) {
                onSelectError(item);
              } else {
                onDismissError?.(item.key);
              }
            }}
            title="Click to inspect or dismiss hint"
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 3 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
                {renderIcon()}
                <span className="bubble-sigil-name">{item.title}</span>
              </div>
              <button
                type="button"
                className="bubble-close-btn"
                onClick={handleDismiss}
                title="Dismiss"
                aria-label="Dismiss error"
              >
                <XIcon size={10} weight="bold" />
              </button>
            </div>

            <div className="bubble-message" style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>
              {item.message}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, opacity: 0.8, fontSize: '0.65rem' }}>
              <span>Slot: <strong>{item.label}</strong></span>
              {item.confidence !== null && item.confidence !== undefined && (
                <span>{(item.confidence * 100).toFixed(0)}% match</span>
              )}
            </div>
          </div>
        );
      })}
    </>
  );
};
