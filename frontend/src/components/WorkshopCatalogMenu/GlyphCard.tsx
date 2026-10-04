
import React, { useRef, useState, useCallback } from 'react';
import {
  Fire as FireIcon,
  Drop as DropIcon,
  Square as SquareIcon,
  Wind as WindIcon,
  Sparkle as SparkleIcon,
  CheckCircle as CheckCircleIcon,
} from '@phosphor-icons/react';
import { UnsavedBadge } from '../UnsavedBadge';

import type { WorkshopGlyph, WorkshopGlyphItem } from '../../types/glyph_types';
export type { WorkshopGlyph, WorkshopGlyphItem };

const getElementIcon = (element: string) => {
  switch (element.toLowerCase()) {
    case 'fire':
      return <FireIcon size={12} weight="fill" className="glyph-badge-fire" />;
    case 'water':
      return <DropIcon size={12} weight="fill" className="glyph-badge-water" />;
    case 'earth':
      return <SquareIcon size={12} weight="fill" className="glyph-badge-earth" />;
    case 'air':
      return <WindIcon size={12} weight="fill" className="glyph-badge-air" />;
    default:
      return <SparkleIcon size={12} weight="fill" className="glyph-badge-arcane" />;
  }
};

export interface GlyphCardProps {
  glyph: WorkshopGlyphItem;
  onSync?: (e: React.MouseEvent) => void | Promise<any>;
  isSelected?: boolean;
  onToggleSelect?: (glyph: WorkshopGlyphItem) => void;
  onClick?: (glyph: WorkshopGlyphItem) => void;
}

export const GlyphCard: React.FC<GlyphCardProps> = ({
  glyph,
  onSync,
  isSelected = false,
  onToggleSelect,
  onClick,
}) => {
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressTriggeredRef = useRef(false);
  const lastClickTimeRef = useRef(0);
  const [isPressing, setIsPressing] = useState(false);

  // Clear long press timer
  const clearLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    setIsPressing(false);
  }, []);

  // Pointer Down — begin tracking for potential long press (450ms)
  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return; // Only primary button / touch
    isLongPressTriggeredRef.current = false;
    setIsPressing(true);

    longPressTimerRef.current = setTimeout(() => {
      isLongPressTriggeredRef.current = true;
      setIsPressing(false);
      onToggleSelect?.(glyph);
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try {
          navigator.vibrate(40);
        } catch (_) {}
      }
    }, 450);
  };

  // Pointer Up & Move
  const handlePointerUp = () => {
    clearLongPress();
  };

  const handlePointerLeave = () => {
    clearLongPress();
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    // If movement is detected, cancel long-press (e.g. user is scrolling)
    if (e.movementX && Math.abs(e.movementX) > 4) clearLongPress();
    if (e.movementY && Math.abs(e.movementY) > 4) clearLongPress();
  };

  // Click Handler: Distinguishes between Single Click (Open Details) and Double Press (Select)
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    // If long press just triggered, swallow click
    if (isLongPressTriggeredRef.current) {
      isLongPressTriggeredRef.current = false;
      return;
    }

    const now = Date.now();
    const timeSinceLastClick = now - lastClickTimeRef.current;

    if (timeSinceLastClick < 320 && timeSinceLastClick > 40) {
      // Double click / Double press detected -> toggle selection
      lastClickTimeRef.current = 0;
      onToggleSelect?.(glyph);
    } else {
      // Single click -> open details popup
      lastClickTimeRef.current = now;
      onClick?.(glyph);
    }
  };

  return (
    <div
      className={`glyph-card-compact ${isSelected ? 'selected' : ''} ${isPressing ? 'is-pressing' : ''}`}
      title={`${glyph.name} — Click to view details, double-click or hold to select`}
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerLeave}
      onPointerMove={handlePointerMove}
      onPointerCancel={clearLongPress}
      style={{
        position: 'relative',
        cursor: 'pointer',
        border: isSelected ? '2px solid var(--color-primary, #b8860b)' : undefined,
        background: isSelected ? 'rgba(184, 134, 11, 0.08)' : undefined,
        boxShadow: isSelected ? '0 0 10px rgba(184, 134, 11, 0.25)' : undefined,
        transition: 'all 0.18s ease',
        transform: isPressing ? 'scale(0.97)' : undefined,
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
    >
      {/* Selected Indicator Badge */}
      {isSelected && (
        <div
          style={{
            position: 'absolute',
            top: '4px',
            right: '4px',
            zIndex: 5,
            color: 'var(--color-primary, #b8860b)',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <CheckCircleIcon size={16} weight="fill" />
        </div>
      )}

      <div className="glyph-card-preview">
        {glyph.coverAsset ? (
          <img src={glyph.coverAsset} alt={glyph.name} />
        ) : (
          getElementIcon(glyph.element)
        )}
      </div>

      <div className="glyph-card-info">
        <div className="glyph-card-name-row">
          <span className="glyph-card-name">{glyph.name}</span>
          <span className="glyph-card-element-icon" title={`Element: ${glyph.element}`}>
            {getElementIcon(glyph.element)}
          </span>
        </div>

        <div className="glyph-card-sub">
          <span style={{ color: 'var(--color-accent)', fontWeight: 600 }}>Tier {glyph.tier}</span>
          <span>|</span>
          <span>by: {glyph.author || 'Anonymous'}</span>
        </div>

        {glyph.description && (
          <p className="glyph-card-desc">
            {glyph.description}
          </p>
        )}
      </div>

      {/* Unsaved / Draft status badge positioned in the bottom-right corner */}
      <UnsavedBadge
        isDraft={glyph.isDraft}
        isUnsaved={glyph.isUnsaved}
        className="status-icon-badge unsaved glyph-card-draft-badge"
        size={10}
        onClick={onSync}
      />
    </div>
  );
};
