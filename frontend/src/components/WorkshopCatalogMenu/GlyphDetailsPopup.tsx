/**
 * @file GlyphDetailsPopup.tsx
 * @description Detailed modal popup for viewing glyph properties, composition,
 * and executing actions like loading onto the canvas pad or selecting for testing ground.
 */

import React from 'react';
import {
  XIcon,
  PenIcon,
  CheckCircleIcon,
  PlusCircleIcon,
  FireIcon,
  DropIcon,
  SquareIcon,
  WindIcon,
  SparkleIcon,
  CompassIcon,
  ShieldCheckIcon,
  TrashIcon,
} from '@phosphor-icons/react';
import type { WorkshopGlyphItem } from './GlyphCard';

export interface GlyphDetailsPopupProps {
  glyph: WorkshopGlyphItem | null;
  isOpen: boolean;
  isSelected?: boolean;
  onClose: () => void;
  onDelete: () => void;
  onLoadIntoCanvas: (glyph: WorkshopGlyphItem) => void;
  onToggleSelect: (glyph: WorkshopGlyphItem) => void;
}

const getElementIcon = (element: string, size = 15) => {
  switch (element.toLowerCase()) {
    case 'fire':
      return <FireIcon size={size} weight="fill" className="glyph-badge-fire" />;
    case 'water':
      return <DropIcon size={size} weight="fill" className="glyph-badge-water" />;
    case 'earth':
      return <SquareIcon size={size} weight="fill" className="glyph-badge-earth" />;
    case 'air':
      return <WindIcon size={size} weight="fill" className="glyph-badge-air" />;
    default:
      return <SparkleIcon size={size} weight="fill" className="glyph-badge-arcane" />;
  }
};

export const GlyphDetailsPopup: React.FC<GlyphDetailsPopupProps> = ({
  glyph,
  isOpen,
  isSelected = false,
  onClose,
  onDelete,
  onLoadIntoCanvas,
  onToggleSelect,
}) => {
  if (!isOpen || !glyph) return null;

  const rawDirections = glyph.composition?.directions;
  const directionsList: string[] = Array.isArray(rawDirections)
    ? rawDirections
    : rawDirections && typeof rawDirections === 'object'
    ? Object.values(rawDirections)
        .map((d: any) => d?.label || d?.sigilId)
        .filter(Boolean)
    : [];

  const rawForms = glyph.composition?.forms || glyph.composition?.formAugmentors;
  const formsList: string[] = Array.isArray(rawForms)
    ? rawForms
    : rawForms && typeof rawForms === 'object'
    ? Object.values(rawForms)
        .map((f: any) => f?.label || f?.sigilId)
        .filter(Boolean)
    : [];

  return (
    <div
      className="modal-overlay"
      style={{
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(18, 15, 12, 0.65)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        animation: 'fadeIn 0.2s ease forwards',
        pointerEvents: 'auto',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="glyph-details-modal"
        style={{
          position: 'relative',
          width: '90%',
          maxWidth: '560px',
          maxHeight: '90vh',
          background: 'var(--color-surface, #fdfbf7)',
          border: '1.5px solid var(--color-border-strong, #c8bead)',
          borderRadius: 'var(--radius-xl, 18px)',
          boxShadow: '0 24px 48px rgba(0, 0, 0, 0.28)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxSizing: 'border-box',
          animation: 'speechBubblePopIn 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        }}
      >
        {/* ── Header ── */}
        <div
          className="glyph-details-header"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '1rem 1.25rem',
            background: 'rgba(0, 0, 0, 0.03)',
            borderBottom: '1px solid var(--color-border, #e0d8cb)',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'var(--color-surface-raised, #ffffff)',
                border: '1px solid var(--color-border, #d1c7b7)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {getElementIcon(glyph.element, 18)}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <h3
                  style={{
                    margin: 0,
                    fontFamily: 'var(--font-heading)',
                    fontSize: '1.15rem',
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    color: 'var(--color-text-primary, #2a2421)',
                  }}
                >
                  {glyph.name}
                </h3>
                <span
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    padding: '2px 7px',
                    borderRadius: '999px',
                    background: 'rgba(201, 162, 39, 0.15)',
                    color: 'var(--color-accent, #c9a227)',
                    border: '1px solid rgba(201, 162, 39, 0.3)',
                    textTransform: 'uppercase',
                  }}
                >
                  Tier {glyph.tier}
                </span>
              </div>
              <span
                style={{
                  fontSize: '0.72rem',
                  color: 'var(--color-text-muted, #7c7267)',
                  textTransform: 'capitalize',
                }}
              >
                {glyph.element} Alignment
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              padding: '6px',
              borderRadius: '50%',
              cursor: 'pointer',
              color: 'var(--color-text-muted, #7c7267)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.15s ease',
            }}
            title="Close details"
            aria-label="Close details"
          >
            <XIcon size={20} weight="bold" />
          </button>
        </div>

        {/* ── Scrollable Body ── */}
        <div
          className="glyph-details-content scroll-inner"
          style={{
            padding: '1.25rem',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.1rem',
          }}
        >
          {/* Top Row: Preview Card & Quick Metadata */}
          <div
            className="glyph-details-top-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: '130px 1fr',
              gap: '1.1rem',
              alignItems: 'center',
            }}
          >
            {/* Visual Preview */}
            <div
              className="glyph-details-preview-box"
              style={{
                width: '130px',
                height: '130px',
                borderRadius: '12px',
                border: '1px solid var(--color-border, #e0d8cb)',
                background: 'radial-gradient(circle, rgba(255,255,255,0.9) 0%, rgba(245,240,230,0.7) 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '10px',
                boxSizing: 'border-box',
                boxShadow: 'inset 0 0 12px rgba(0,0,0,0.04)',
              }}
            >
              {glyph.coverAsset ? (
                <img
                  src={glyph.coverAsset}
                  alt={glyph.name}
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              ) : (
                getElementIcon(glyph.element, 48)
              )}
            </div>

            {/* Metadata Summary */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <p
                style={{
                  margin: 0,
                  fontSize: '0.86rem',
                  lineHeight: 1.45,
                  color: 'var(--color-text-secondary, #5c5249)',
                }}
              >
                {glyph.description || 'No description provided for this formation.'}
              </p>

              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                  marginTop: '0.35rem',
                  fontSize: '0.74rem',
                  color: 'var(--color-text-muted, #7c7267)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <span style={{ fontWeight: 600 }}>Author:</span> {glyph.author || 'Sanctuary Scribe'}
                </div>
                <span>•</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <span style={{ fontWeight: 600 }}>Created:</span> {glyph.createdAt}
                </div>
                {glyph.confidenceScore != null && (
                  <>
                    <span>•</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <ShieldCheckIcon size={14} color="#10b981" weight="bold" />
                      <span style={{ fontWeight: 600 }}>Purity:</span> {Math.round(glyph.confidenceScore * 100)}%
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Composition Breakdown */}
          <div
            style={{
              background: 'rgba(0, 0, 0, 0.02)',
              border: '1px solid var(--color-border, #e0d8cb)',
              borderRadius: '10px',
              padding: '0.85rem 1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.55rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <CompassIcon size={16} weight="bold" color="var(--color-primary, #4a3b32)" />
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: 'var(--color-primary, #2c2522)',
                }}
              >
                Runic Formation Matrix
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.65rem' }}>
              {/* Effector */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--color-text-dim, #9c8e80)', textTransform: 'uppercase' }}>
                  Center Effector
                </span>
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--color-text-primary, #2c2522)' }}>
                  {typeof glyph.composition?.effector === 'string'
                    ? glyph.composition.effector
                    : glyph.composition?.effector?.label || glyph.composition?.effector?.sigilId || 'None'}
                </span>
              </div>

              {/* Cardinal Anchors */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--color-text-dim, #9c8e80)', textTransform: 'uppercase' }}>
                  Directional Anchors
                </span>
                <span style={{ fontSize: '0.82rem', color: 'var(--color-text-primary, #2c2522)' }}>
                  {directionsList.length > 0 ? directionsList.join(', ') : 'None'}
                </span>
              </div>

              {/* Form Augmentors */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--color-text-dim, #9c8e80)', textTransform: 'uppercase' }}>
                  Form Augmentors
                </span>
                <span style={{ fontSize: '0.82rem', color: 'var(--color-text-primary, #2c2522)' }}>
                  {formsList.length > 0 ? formsList.join(', ') : 'None'}
                </span>
              </div>
            </div>
          </div>

          <div
            style={{
              fontSize: '0.73rem',
              color: 'var(--color-text-muted, #7c7267)',
              fontStyle: 'italic',
              marginTop: '-0.3rem',
            }}
          >
            Tip: Double-click or long-press cards in the catalog to quick-select without opening details.
          </div>
        </div>

        {/* ── Footer Actions ── */}
        <div
          className="glyph-details-footer"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.85rem 1.25rem',
            background: 'rgba(0, 0, 0, 0.03)',
            borderTop: '1px solid var(--color-border, #e0d8cb)',
            flexShrink: 0,
            gap: '0.75rem',
          }}
        >
          {/* Select for Testing Ground Button */}
          <button
            type="button"
            onClick={() => onToggleSelect(glyph)}
            className="btn btn-secondary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.5rem 1rem',
              fontSize: '0.78rem',
              borderRadius: '999px',
            }}
          >
            {isSelected ? (
              <>
                <CheckCircleIcon size={16} weight="fill" color="#10b981" />
                <span>Selected</span>
              </>
            ) : (
              <>
                <PlusCircleIcon size={16} weight="bold" />
                <span>Select for Arena</span>
              </>
            )}
          </button>
          {/* Load into Drawing Pad Button */}
          <button
            type="button"
            onClick={() => {
              onLoadIntoCanvas(glyph);
              onClose();
            }}
            className="btn btn-primary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.5rem 1.25rem',
              fontSize: '0.78rem',
              borderRadius: '999px',
            }}
          >
            <PenIcon size={16} weight="bold" />
            <span>Load Drawing</span>
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="selection-pill-action selection-pill-delete"
            style={{
              color: '#b91c1c',
              borderColor: 'rgba(185, 28, 28, 0.35)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '3px',
            }}
            title="Delete selected glyphs"
          >
            <TrashIcon size={12} weight="bold" />
            Delete
          </button>


        </div>
      </div>
    </div>
  );
};
