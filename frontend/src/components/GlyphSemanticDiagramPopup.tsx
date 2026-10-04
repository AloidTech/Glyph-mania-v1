/**
 * @file GlyphSemanticDiagramPopup.tsx
 * @description Floating Semantic Formation Diagram Popup positioned at bottom-right.
 * Visualizes the 9-slot glyph spatial composition:
 * - Central Effector
 * - 4 Cardinal Direction Anchors (Top/North, Right/East, Bottom/South, Left/West)
 * - 4 Corner Form Augmentors (NW, NE, SW, SE)
 * - Outer boundary enclosing ring (open vs closed indicator)
 * - Per-slot recognition confidence & Solidity analysis verification status.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Compass as CompassIcon,
  CaretDown as CaretDownIcon,
  CaretUp as CaretUpIcon,
  CheckCircle as CheckCircleIcon,
  WarningCircle as WarningCircleIcon,
  Circle as CircleIcon,
  Info as InfoIcon,
  ShieldCheck as ShieldCheckIcon,
} from '@phosphor-icons/react';
import type { GlyphCompositionAnalysis } from '../lib/ml/glyph_semantic_engine';
import type { SolidityAnalysis, CanvasSigilError } from '../lib/glyph_helpers/glyph_solidity';
import type { EnclosingCircleDetectionResult } from '../lib/glyph_helpers/glyph_detection';

export interface GlyphSemanticDiagramPopupProps {
  analysis: GlyphCompositionAnalysis | null;
  solidity?: SolidityAnalysis | null;
  isCircleOpen?: boolean;
  circleDetection?: EnclosingCircleDetectionResult | null;
  canvasErrors?: CanvasSigilError[];
  isOpen?: boolean;
  onToggleOpen?: () => void;
  onClose?: () => void;
  defaultExpanded?: boolean;
  className?: string;
}

export const GlyphSemanticDiagramPopup: React.FC<GlyphSemanticDiagramPopupProps> = ({
  analysis,
  solidity,
  isCircleOpen = false,
  circleDetection,
  canvasErrors = [],
  defaultExpanded = true,
  className = '',
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // Auto-expand whenever a new analysis arrives
  useEffect(() => {
    if (analysis) {
      setIsExpanded(true);
    }
  }, [analysis]);

  const isSolid = solidity?.isSolid ?? false;
  const totalComponents = analysis?.rawCrops?.length ?? 0;

  // Build full diagnostics error list:
  // Combines canvasSigilErrors (low accuracy, type mismatch, unrecognized) with any missing slot errors from solidity
  const allSlotErrors = useMemo(() => {
    const errorMap = new Map<string, {
      slotKey: string;
      title: string;
      label: string;
      errorType: string;
      message: string;
      confidence?: number | null;
      cropUrl?: string | null;
    }>();

    // 1. From canvasSigilErrors
    for (const err of canvasErrors) {
      const crop = analysis?.semanticCrops?.[err.key];
      errorMap.set(err.key, {
        slotKey: err.key,
        title: err.title,
        label: err.label,
        errorType: err.errorType,
        message: err.message,
        confidence: err.confidence,
        cropUrl: crop?.dataUrl || undefined,
      });
    }

    // 2. From solidity.slotErrors (include missing errors)
    if (solidity?.slotErrors) {
      for (const [slotKey, errors] of Object.entries(solidity.slotErrors)) {
        if (errorMap.has(slotKey)) continue;
        const missingErr = errors.find((e) => e.type === 'missing');
        if (missingErr) {
          const title =
            slotKey === 'effector'
              ? 'Center Effector'
              : slotKey.includes('top') || slotKey.includes('bottom') || slotKey.includes('left') || slotKey.includes('right')
                ? slotKey.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())
                : slotKey;
          errorMap.set(slotKey, {
            slotKey,
            title,
            label: 'Missing',
            errorType: 'missing',
            message: missingErr.message,
            confidence: null,
            cropUrl: undefined,
          });
        }
      }
    }

    return Array.from(errorMap.values());
  }, [canvasErrors, solidity, analysis]);

  // Set of slot keys that currently have errors
  const errorSlotKeys = useMemo(() => new Set(allSlotErrors.map((e) => e.slotKey)), [allSlotErrors]);

  // Helper to inspect slot states
  const getSlotData = (key: string) => analysis?.semanticCrops?.[key];

  // Circle detection status
  const circleClosed = circleDetection ? circleDetection.isClosed : !isCircleOpen;
  const hasCircle = circleDetection ? circleDetection.hasCircle : totalComponents > 0;
  const circleCoverage = circleDetection ? Math.round(circleDetection.coverage * 100) : null;
  const maxGap = circleDetection ? Math.round(circleDetection.maxGapAngle) : null;

  return (
    <div
      className={`semantic-diagram-popup ${className}`}
      style={{
        position: 'fixed',
        bottom: '1.25rem',
        right: '1.25rem',
        zIndex: 60,
        pointerEvents: 'auto',
        width: isExpanded ? '330px' : '230px',
        maxHeight: isExpanded ? 'calc(100vh - 5rem)' : 'auto',
        background: 'rgba(253, 251, 247, 0.97)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1.5px solid var(--color-border-strong, #c8bead)',
        borderRadius: '14px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.22)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        transition: 'width 0.22s cubic-bezier(0.16, 1, 0.3, 1), transform 0.2s ease',
        fontFamily: 'var(--font-sans, system-ui, sans-serif)',
      }}
    >
      {/* ── Popup Header ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.55rem 0.8rem',
          background: 'rgba(0, 0, 0, 0.04)',
          borderBottom: isExpanded ? '1px solid var(--color-border, #d8d0c2)' : 'none',
          cursor: 'pointer',
          userSelect: 'none',
          flexShrink: 0,
        }}
        onClick={() => setIsExpanded((prev) => !prev)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          <CompassIcon size={18} weight="fill" color="var(--color-primary, #4a3b32)" />
          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, letterSpacing: '0.04em', color: 'var(--color-primary, #2c2522)' }}>
            FORMATION DIAGRAM
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          {/* Solidity / Issues Badge */}
          {analysis && (
            <span
              style={{
                fontSize: '0.66rem',
                fontWeight: 700,
                padding: '2px 7px',
                borderRadius: '9999px',
                background: isSolid ? '#ecfdf5' : allSlotErrors.length > 0 ? '#fef2f2' : '#fffbeb',
                color: isSolid ? '#059669' : allSlotErrors.length > 0 ? '#dc2626' : '#d97706',
                border: `1px solid ${isSolid ? '#a7f3d0' : allSlotErrors.length > 0 ? '#fca5a5' : '#fde68a'}`,
              }}
            >
              {isSolid ? 'Solid' : allSlotErrors.length > 0 ? `${allSlotErrors.length}` : 'Unsealed'}
            </span>
          )}

          {/* Reverted simple caret dropdown button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded((prev) => !prev);
            }}
            style={{
              background: 'transparent',
              border: 'none',
              padding: '2px 4px',
              cursor: 'pointer',
              color: 'var(--color-text-muted, #7c7267)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title={isExpanded ? 'Collapse formation diagram' : 'Expand formation diagram'}
            aria-label={isExpanded ? 'Collapse formation diagram' : 'Expand formation diagram'}
          >
            {isExpanded ? (
              <CaretDownIcon size={16} weight="bold" />
            ) : (
              <CaretUpIcon size={16} weight="bold" />
            )}
          </button>
        </div>
      </div>

      {/* ── Scrollable Body Content ── */}
      {isExpanded && (
        <div
          style={{
            padding: '0.75rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.65rem',
            overflowY: 'auto',
            maxHeight: 'calc(100vh - 8rem)',
          }}
        >
          {/* 1. Circular Runic Diagram Stage */}
          <div
            style={{
              position: 'relative',
              width: '100%',
              height: '210px',
              background: 'rgba(0, 0, 0, 0.02)',
              borderRadius: '10px',
              border: '1px solid var(--color-border, #e0d8cb)',
              overflow: 'hidden',
              flexShrink: 0,
            }}
          >
            {/* SVG Background Grid & Enclosing Ring Indicator */}
            <svg
              viewBox="0 0 200 200"
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
            >
              {/* Outer boundary circle guide */}
              <circle
                cx="100"
                cy="100"
                r="78"
                fill="none"
                stroke={!hasCircle ? '#d1c7b7' : circleClosed ? '#10b981' : '#f59e0b'}
                strokeWidth={hasCircle ? '2' : '1'}
                strokeDasharray={hasCircle && !circleClosed ? '6 4' : 'none'}
                opacity={hasCircle ? 0.85 : 0.4}
              />

              {/* Cardinal axis crosshair */}
              <line x1="100" y1="20" x2="100" y2="180" stroke="#c8bead" strokeWidth="1" strokeDasharray="3 3" opacity={0.5} />
              <line x1="20" y1="100" x2="180" y2="100" stroke="#c8bead" strokeWidth="1" strokeDasharray="3 3" opacity={0.5} />
              {/* Diagonal axis */}
              <line x1="42" y1="42" x2="158" y2="158" stroke="#c8bead" strokeWidth="0.8" strokeDasharray="2 4" opacity={0.35} />
              <line x1="158" y1="42" x2="42" y2="158" stroke="#c8bead" strokeWidth="0.8" strokeDasharray="2 4" opacity={0.35} />
            </svg>

            {/* Central Effector Node */}
            {(() => {
              const eff = getSlotData('effector');
              const hasEff = !!eff?.dataUrl;
              const effSolid = solidity?.slots?.effector ?? false;
              const hasError = errorSlotKeys.has('effector');

              return (
                <div
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '62px',
                    height: '62px',
                    borderRadius: '50%',
                    background: hasEff ? '#ffffff' : 'rgba(255,255,255,0.7)',
                    border: `2px solid ${hasError ? '#ef4444' : effSolid ? '#10b981' : hasEff ? '#f59e0b' : '#d1c7b7'
                      }`,
                    boxShadow: hasError
                      ? '0 0 10px rgba(239, 68, 68, 0.4)'
                      : effSolid
                        ? '0 0 10px rgba(16, 185, 129, 0.3)'
                        : '0 2px 6px rgba(0,0,0,0.08)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 10,
                    textAlign: 'center',
                    padding: '2px',
                  }}
                  title={eff?.recognition?.label ? `Effector: ${eff.recognition.label}` : 'Central Effector Slot'}
                >
                  {hasError && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '-3px',
                        right: '-3px',
                        background: '#ef4444',
                        color: '#fff',
                        borderRadius: '50%',
                        width: '14px',
                        height: '14px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.55rem',
                        fontWeight: 900,
                      }}
                    >
                      !
                    </div>
                  )}
                  {eff?.dataUrl ? (
                    <img
                      src={eff.dataUrl}
                      alt="Effector"
                      style={{ width: '30px', height: '30px', objectFit: 'contain' }}
                    />
                  ) : (
                    <span style={{ fontSize: '0.62rem', color: '#9c9284', fontWeight: 600 }}>Center</span>
                  )}
                  <span
                    style={{
                      fontSize: '0.5rem',
                      color: hasError ? '#dc2626' : effSolid ? '#059669' : '#6b6256',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                    }}
                  >
                    {eff?.recognition?.label ? eff.recognition.label.slice(0, 8) : 'Effector'}
                  </span>
                </div>
              );
            })()}

            {/* 4 Cardinal Direction Nodes */}
            {[
              { key: 'top', label: 'N', top: '15%', left: '50%' },
              { key: 'right', label: 'E', top: '50%', left: '86%' },
              { key: 'bottom', label: 'S', top: '85%', left: '50%' },
              { key: 'left', label: 'W', top: '50%', left: '14%' },
            ].map((node) => {
              const data = getSlotData(node.key);
              const hasMark = !!data?.dataUrl;
              const isSlotSolid = solidity?.slots?.directions?.[node.key as 'top' | 'right' | 'bottom' | 'left'] ?? false;
              const hasError = errorSlotKeys.has(node.key);

              return (
                <div
                  key={node.key}
                  style={{
                    position: 'absolute',
                    top: node.top,
                    left: node.left,
                    transform: 'translate(-50%, -50%)',
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    background: hasMark ? '#ffffff' : 'rgba(255,255,255,0.6)',
                    border: `1.5px solid ${hasError ? '#ef4444' : isSlotSolid ? '#10b981' : hasMark ? '#f59e0b' : '#d8d0c2'
                      }`,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 8,
                    boxShadow: hasError
                      ? '0 0 8px rgba(239, 68, 68, 0.35)'
                      : '0 1px 4px rgba(0,0,0,0.06)',
                  }}
                  title={`${node.label} Anchor: ${data?.recognition?.label || (hasMark ? 'Drawn' : 'Empty')}`}
                >
                  {hasError && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '-3px',
                        right: '-3px',
                        background: '#ef4444',
                        color: '#fff',
                        borderRadius: '50%',
                        width: '12px',
                        height: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.5rem',
                        fontWeight: 900,
                      }}
                    >
                      !
                    </div>
                  )}
                  {data?.dataUrl ? (
                    <img src={data.dataUrl} alt={node.label} style={{ width: '20px', height: '20px', objectFit: 'contain' }} />
                  ) : (
                    <span style={{ fontSize: '0.62rem', fontWeight: 700, color: '#9c9284' }}>{node.label}</span>
                  )}
                </div>
              );
            })}

            {/* 4 Corner Form Nodes */}
            {[
              { key: 'topLeft', label: 'NW', top: '22%', left: '22%' },
              { key: 'topRight', label: 'NE', top: '22%', left: '78%' },
              { key: 'bottomLeft', label: 'SW', top: '78%', left: '22%' },
              { key: 'bottomRight', label: 'SE', top: '78%', left: '78%' },
            ].map((node) => {
              const data = getSlotData(node.key);
              const hasMark = !!data?.dataUrl;
              const isSlotSolid = solidity?.slots?.formAugmentors?.[node.key as 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight'] ?? false;
              const hasError = errorSlotKeys.has(node.key);

              return (
                <div
                  key={node.key}
                  style={{
                    position: 'absolute',
                    top: node.top,
                    left: node.left,
                    transform: 'translate(-50%, -50%)',
                    width: '28px',
                    height: '28px',
                    borderRadius: '6px',
                    background: hasMark ? '#ffffff' : 'rgba(255,255,255,0.5)',
                    border: `1px solid ${hasError ? '#ef4444' : isSlotSolid ? '#10b981' : hasMark ? '#f59e0b' : '#e0d8cb'
                      }`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 6,
                    boxShadow: hasError ? '0 0 6px rgba(239, 68, 68, 0.35)' : 'none',
                  }}
                  title={`${node.label} Form: ${data?.recognition?.label || (hasMark ? 'Drawn' : 'Empty')}`}
                >
                  {hasError && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '-3px',
                        right: '-3px',
                        background: '#ef4444',
                        color: '#fff',
                        borderRadius: '50%',
                        width: '10px',
                        height: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.45rem',
                        fontWeight: 900,
                      }}
                    >
                      !
                    </div>
                  )}
                  {data?.dataUrl ? (
                    <img src={data.dataUrl} alt={node.label} style={{ width: '16px', height: '16px', objectFit: 'contain' }} />
                  ) : (
                    <span style={{ fontSize: '0.52rem', fontWeight: 600, color: '#a89f92' }}>{node.label}</span>
                  )}
                </div>
              );
            })}
          </div>

          {/* 2. Boundary Circle Detection Card */}
          <div
            style={{
              padding: '0.5rem 0.65rem',
              background: 'rgba(0, 0, 0, 0.03)',
              borderRadius: '8px',
              border: '1px solid var(--color-border, #e0d8cb)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.35rem',
              fontSize: '0.72rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: 600, color: '#4a3b32' }}>
                <CircleIcon size={13} weight="bold" />
                <span>Boundary Circle:</span>
              </div>
              <span
                style={{
                  fontWeight: 700,
                  fontSize: '0.68rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  padding: '1px 6px',
                  borderRadius: '9999px',
                  background: !hasCircle ? '#f3f4f6' : circleClosed ? '#ecfdf5' : '#fffbeb',
                  color: !hasCircle ? '#6b7280' : circleClosed ? '#059669' : '#d97706',
                  border: `1px solid ${!hasCircle ? '#e5e7eb' : circleClosed ? '#a7f3d0' : '#fde68a'}`,
                }}
              >
                {!hasCircle ? (
                  <>None</>
                ) : circleClosed ? (
                  <><CheckCircleIcon size={11} weight="fill" /> Closed Loop</>
                ) : (
                  <><WarningCircleIcon size={11} weight="fill" /> Open Loop</>
                )}
              </span>
            </div>

            {hasCircle && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#6b6256', fontSize: '0.68rem' }}>
                {circleCoverage !== null && <span>Coverage: <strong>{circleCoverage}%</strong></span>}
                {maxGap !== null && <span>Max Gap: <strong>{maxGap}°</strong></span>}
                {circleDetection?.innerSigilsCount !== undefined && (
                  <span>Enclosed: <strong>{circleDetection.innerSigilsCount}</strong></span>
                )}
              </div>
            )}
          </div>

          {/* 3. Errors & Diagnostic Alerts (Ported from GlyphTestingPage) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '0.7rem',
                fontWeight: 700,
                color: 'var(--color-primary, #3b322a)',
                letterSpacing: '0.03em',
                textTransform: 'uppercase',
              }}
            >
              <span>Diagnostic Breakdown</span>
              {allSlotErrors.length > 0 ? (
                <span style={{ color: '#dc2626', fontSize: '0.65rem' }}>
                  {allSlotErrors.length} Issue{allSlotErrors.length > 1 ? 's' : ''}
                </span>
              ) : isSolid ? (
                <span style={{ color: '#059669', fontSize: '0.65rem', display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                  <CheckCircleIcon size={12} weight="fill" /> All Solid
                </span>
              ) : null}
            </div>

            {allSlotErrors.length === 0 ? (
              <div
                style={{
                  padding: '0.5rem',
                  borderRadius: '6px',
                  background: isSolid ? '#ecfdf5' : '#f9fafb',
                  border: `1px solid ${isSolid ? '#a7f3d0' : '#e5e7eb'}`,
                  color: isSolid ? '#065f46' : '#6b7280',
                  fontSize: '0.7rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}
              >
                {isSolid ? (
                  <>
                    <ShieldCheckIcon size={16} weight="fill" color="#059669" />
                    <span>Formation is completely sealed and structurally solid.</span>
                  </>
                ) : (
                  <>
                    <InfoIcon size={14} weight="fill" color="#9ca3af" />
                    <span>Draw symbols on the atelier pad and test to inspect formation.</span>
                  </>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                {allSlotErrors.map((err) => {
                  const isAccuracy = err.errorType === 'low_accuracy';
                  const isMismatch = err.errorType === 'type_mismatch' || err.errorType === 'form_mismatch';
                  const isUnrec = err.errorType === 'unrecognized';

                  const badgeColor = isAccuracy ? '#d97706' : isMismatch ? '#dc2626' : isUnrec ? '#2563eb' : '#6b7280';
                  const badgeBg = isAccuracy ? '#fffbeb' : isMismatch ? '#fef2f2' : isUnrec ? '#eff6ff' : '#f3f4f6';
                  const badgeBorder = isAccuracy ? '#fde68a' : isMismatch ? '#fca5a5' : isUnrec ? '#bfdbfe' : '#e5e7eb';

                  return (
                    <div
                      key={err.slotKey}
                      style={{
                        padding: '0.45rem 0.55rem',
                        borderRadius: '6px',
                        background: '#ffffff',
                        border: '1px solid var(--color-border, #d8d0c2)',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                        display: 'flex',
                        gap: '0.45rem',
                        alignItems: 'flex-start',
                      }}
                    >
                      {/* Slot Crop Thumbnail */}
                      {err.cropUrl ? (
                        <img
                          src={err.cropUrl}
                          alt={err.title}
                          style={{
                            width: '28px',
                            height: '28px',
                            objectFit: 'contain',
                            borderRadius: '4px',
                            border: '1px solid #e5e7eb',
                            background: '#fafafa',
                            flexShrink: 0,
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '4px',
                            background: '#f3f4f6',
                            border: '1px solid #e5e7eb',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.62rem',
                            fontWeight: 700,
                            color: '#9ca3af',
                            flexShrink: 0,
                          }}
                        >
                          {err.slotKey.slice(0, 2).toUpperCase()}
                        </div>
                      )}

                      {/* Error Info */}
                      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1, gap: '2px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
                          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#2a2421', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {err.title} {err.label && err.label !== 'Missing' ? `(${err.label})` : ''}
                          </span>
                          <span
                            style={{
                              fontSize: '0.6rem',
                              fontWeight: 700,
                              padding: '1px 5px',
                              borderRadius: '4px',
                              background: badgeBg,
                              color: badgeColor,
                              border: `1px solid ${badgeBorder}`,
                              whiteSpace: 'nowrap',
                              flexShrink: 0,
                            }}
                          >
                            {isAccuracy
                              ? `Low Acc (${err.confidence ? Math.round(err.confidence * 100) : '?'}%)`
                              : isMismatch
                                ? 'Mismatch'
                                : isUnrec
                                  ? 'Unrecognized'
                                  : 'Missing'}
                          </span>
                        </div>
                        <p style={{ margin: 0, fontSize: '0.65rem', color: '#6b6256', lineHeight: 1.3 }}>
                          {err.message}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default GlyphSemanticDiagramPopup;

