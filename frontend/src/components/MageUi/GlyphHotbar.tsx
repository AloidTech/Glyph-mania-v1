/**
 * @file GlyphHotbar.tsx
 * @description Mage UI bottom glyph inventory selector hotbar.
 * Modeled after the classic RPG/Minecraft hotbar with 9 slots, elevated active metallic frame,
 * number keys (1-9) & mouse wheel selection, and an "Add" button routing to the Workshop.
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { PlusIcon, SparkleIcon } from '@phosphor-icons/react';
import { useGameStore } from '../../lib/stores/store';
import type { WorkshopGlyphItem } from '../WorkshopCatalogMenu/GlyphCard';

export const STARTER_TESTING_GLYPHS: WorkshopGlyphItem[] = [
  {
    id: 'starter-fire-dash',
    name: 'Ignis Dash',
    description: 'High-velocity piercing flame projectile.',
    element: 'fire',
    tier: 1,
    author: 'Sanctuary',
    isPublic: true,
    createdAt: 'Default',
    confidenceScore: 0.98,
    coverAsset: '/sigils/svg/eff-fire.svg',
    composition: {
      effector: { sigilId: 'eff-fire', label: 'Fire Effector', element: 'fire' },
      directions: {
        right: { sigilId: 'pos-right', label: 'East' },
      },
      formAugmentors: {
        topLeft: { sigilId: 'form-dash', label: 'Dash', formType: 'dash' },
      },
      strokes: [],
    },
  },
  {
    id: 'starter-water-vortex',
    name: 'Aqua Vortex',
    description: 'Whirling vortex drawing surrounding energy inward.',
    element: 'water',
    tier: 1,
    author: 'Sanctuary',
    isPublic: true,
    createdAt: 'Default',
    confidenceScore: 0.95,
    coverAsset: '/sigils/svg/eff-water.svg',
    composition: {
      effector: { sigilId: 'eff-water', label: 'Water Effector', element: 'water' },
      directions: {
        top: { sigilId: 'pos-up', label: 'North' },
        bottom: { sigilId: 'pos-down', label: 'South' },
      },
      formAugmentors: {
        topLeft: { sigilId: 'form-whirl', label: 'Whirl', formType: 'whirl' },
      },
      strokes: [],
    },
  },
  {
    id: 'starter-earth-aegis',
    name: 'Terra Aegis',
    description: 'Dense earthen bastion focused along cardinal anchors.',
    element: 'earth',
    tier: 1,
    author: 'Sanctuary',
    isPublic: true,
    createdAt: 'Default',
    confidenceScore: 0.92,
    coverAsset: '/sigils/svg/eff-earth.svg',
    composition: {
      effector: { sigilId: 'eff-earth', label: 'Earth Effector', element: 'earth' },
      directions: {
        top: { sigilId: 'pos-up', label: 'North' },
        right: { sigilId: 'pos-right', label: 'East' },
        bottom: { sigilId: 'pos-down', label: 'South' },
        left: { sigilId: 'pos-left', label: 'West' },
      },
      formAugmentors: {
        topLeft: { sigilId: 'form-compress', label: 'Compress', formType: 'compress' },
      },
      strokes: [],
    },
  },
  {
    id: 'starter-air-gale',
    name: 'Zephyr Gale',
    description: 'Swift atmospheric burst propelling caster in chosen heading.',
    element: 'air',
    tier: 1,
    author: 'Sanctuary',
    isPublic: true,
    createdAt: 'Default',
    confidenceScore: 0.91,
    coverAsset: '/sigils/svg/eff-air.svg',
    composition: {
      effector: { sigilId: 'eff-air', label: 'Air Effector', element: 'air' },
      directions: {
        top: { sigilId: 'pos-up', label: 'North' },
        right: { sigilId: 'pos-right', label: 'East' },
      },
      formAugmentors: {
        topLeft: { sigilId: 'form-dash', label: 'Dash', formType: 'dash' },
      },
      strokes: [],
    },
  },
];

const ELEMENT_COLORS: Record<string, string> = {
  fire: '#ef4444',
  water: '#38bdf8',
  earth: '#10b981',
  air: '#a855f7',
  light: '#fde047',
  shadow: '#6366f1',
};

interface GlyphHotbarProps {
  onSelectGlyph?: (glyph: WorkshopGlyphItem | null, index: number) => void;
  activeIndex?: number;
}

export const GlyphHotbar: React.FC<GlyphHotbarProps> = ({
  onSelectGlyph,
  activeIndex: controlledIndex,
}) => {
  const setScreen = useGameStore((state) => state.setScreen);
  const rawGlyphs = useGameStore((state) => state.selectedTestingGlyphs);

  // Use stored glyphs, or fallback to starter glyphs if empty
  const glyphs: WorkshopGlyphItem[] = (rawGlyphs && rawGlyphs.length > 0)
    ? rawGlyphs
    : STARTER_TESTING_GLYPHS;

  const [internalActiveIndex, setInternalActiveIndex] = useState(0);
  const activeIndex = controlledIndex !== undefined ? controlledIndex : internalActiveIndex;
  const glyphHeldState = useGameStore((state) => state.glyphHeldState);

  useEffect(() => {
    const handleExternalSelect = (e: Event) => {
      const custom = e as CustomEvent;
      if (typeof custom.detail?.index === 'number') {
        setInternalActiveIndex(custom.detail.index);
      }
    };
    window.addEventListener('glyph-hotbar-select', handleExternalSelect);
    return () => {
      window.removeEventListener('glyph-hotbar-select', handleExternalSelect);
    };
  }, []);

  const [bannerVisible, setBannerVisible] = useState(true);
  const bannerTimeoutRef = useRef<number | null>(null);

  // Show banner briefly whenever selection changes
  const showBannerTemporarily = useCallback(() => {
    setBannerVisible(true);
    if (bannerTimeoutRef.current) clearTimeout(bannerTimeoutRef.current);
    bannerTimeoutRef.current = window.setTimeout(() => {
      setBannerVisible(false);
    }, 2800);
  }, []);

  const selectSlot = useCallback(
    (index: number) => {
      const boundedIndex = Math.max(0, Math.min(8, index));
      setInternalActiveIndex(boundedIndex);
      showBannerTemporarily();
      const selectedItem = glyphs[boundedIndex] ?? null;
      if (onSelectGlyph) {
        onSelectGlyph(selectedItem, boundedIndex);
      }
    },
    [glyphs, onSelectGlyph, showBannerTemporarily]
  );

  // Keyboard number keys 1 through 9
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement;
      if (
        activeElement &&
        (activeElement.tagName === 'INPUT' ||
          activeElement.tagName === 'TEXTAREA' ||
          (activeElement as HTMLElement).isContentEditable)
      ) {
        return;
      }

      const num = parseInt(e.key, 10);
      if (!isNaN(num) && num >= 1 && num <= 9) {
        e.preventDefault();
        selectSlot(num - 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectSlot]);

  // Mouse wheel scroll to cycle active slot
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.stopPropagation();
      e.preventDefault();
      if (e.deltaY > 0) {
        // Scroll down -> next slot
        selectSlot((activeIndex + 1) % 9);
      } else if (e.deltaY < 0) {
        // Scroll up -> previous slot
        selectSlot((activeIndex - 1 + 9) % 9);
      }
    },
    [activeIndex, selectSlot]
  );

  const activeGlyph = glyphs[activeIndex] ?? null;

  return (
    <div className="gameplay-hotbar-container" onWheel={handleWheel}>
      {/* Floating Active Glyph Banner (Minecraft style item name floating above hotbar) */}
      {bannerVisible && activeGlyph && (
        <div className="gameplay-hotbar-label-banner">
          <span
            className="gameplay-hotbar-label-element"
            style={{ color: ELEMENT_COLORS[activeGlyph.element] || '#38bdf8' }}
          >
            {activeGlyph.element}
          </span>
          <span className="gameplay-hotbar-label-text">{activeGlyph.name}</span>
        </div>
      )}

      {/* Main 9-Slot Hotbar Strip */}
      <div className="gameplay-hotbar-strip">
        {Array.from({ length: 9 }).map((_, i) => {
          const glyph = glyphs[i];
          const isActive = i === activeIndex;
          const isSlotActiveMode = isActive && (glyphHeldState === 'aim' || glyphHeldState === 'place' || glyphHeldState === 'held');

          return (
            <div
              key={`hotbar-slot-${i}`}
              className={`gameplay-hotbar-slot ${glyph ? 'has-item' : 'is-empty'} ${isActive ? 'is-active' : ''} ${isSlotActiveMode ? 'is-held is-aiming' : ''}`}
              onClick={() => selectSlot(i)}
              title={glyph ? `${glyph.name} (${glyph.element.toUpperCase()}) - Press [${i + 1}]` : `Slot ${i + 1}`}
            >
              {/* Glyph preview if slot contains a glyph */}
              {glyph ? (
                <img
                  src={glyph.coverAsset || '/sigils/svg/eff-fire.svg'}
                  alt={glyph.name}
                  className="gameplay-hotbar-glyph-icon"
                />
              ) : (
                <div style={{ opacity: 0.15 }}>
                  <SparkleIcon size={16} weight="duotone" color="#64748b" />
                </div>
              )}
            </div>
          );
        })}

        {/* Add Button Slot: Returns to Workshop */}
        <button
          type="button"
          className="gameplay-hotbar-add-slot"
          onClick={() => setScreen('IN_GAME')}
          title="Add or Craft More Glyphs in Workshop"
          aria-label="Add or Craft More Glyphs in Workshop"
        >
          <PlusIcon size={22} weight="bold" />
        </button>
      </div>
    </div>
  );
};
