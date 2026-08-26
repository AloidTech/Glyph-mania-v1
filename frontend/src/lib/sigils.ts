import type { Sigil } from './types/glyph_types';

// ===== Tier‑1 Sigil Catalog =====
// Canonical source of truth for all tier‑1 sigils.
// Both the React UI and the atlas build script reference this array.

export const tier1Sigils: Sigil[] = [
  // ===== Effectors (element, center slot only) =====
  {
    id: 'eff-fire',
    label: 'Fire',
    svgPath: '/sigils/svg/eff-fire.svg',
    textureKey: 'eff-fire',
    type: 'effector',
    element: 'fire',
    tier: 1,
    description: 'Fire effector, burns targets',
  },
  {
    id: 'eff-water',
    label: 'Water',
    svgPath: '/sigils/svg/eff-water.svg',
    textureKey: 'eff-water',
    type: 'effector',
    element: 'water',
    tier: 1,
    description: 'Water effector, flows and douses',
  },
  {
    id: 'eff-earth',
    label: 'Earth',
    svgPath: '/sigils/svg/eff-earth.svg',
    textureKey: 'eff-earth',
    type: 'effector',
    element: 'earth',
    tier: 1,
    description: 'Earth effector, grounds and fortifies',
  },
  {
    id: 'eff-air',
    label: 'Air',
    svgPath: '/sigils/svg/eff-air.svg',
    textureKey: 'eff-air',
    type: 'effector',
    element: 'air',
    tier: 1,
    description: 'Air effector, lifts and disperses',
  },

  // ===== Position Augmentor (cardinal slots — direction comes from slot, not the sigil) =====
  {
    id: 'aug-position',
    label: 'Position',
    svgPath: '/sigils/svg/aug-position.svg',
    textureKey: 'aug-position',
    type: 'augmentor',
    augmentorType: 'position',
    tier: 1,
    description: 'Position augmentor, moves glyph cardinally',
  },

  // ===== Form Augmentors (diagonal slots — shape comes from the sigil itself) =====
  {
    id: 'aug-form-dash',
    label: 'Dash',
    svgPath: '/sigils/svg/aug-form-dash.svg',
    textureKey: 'aug-form-dash',
    type: 'augmentor',
    augmentorType: 'form',
    formType: 'dash',
    tier: 1,
    description: 'Dash form augmentor, creates linear glyphs',
  },
  {
    id: 'aug-form-whirl',
    label: 'Whirl',
    svgPath: '/sigils/svg/aug-form-whirl.svg',
    textureKey: 'aug-form-whirl',
    type: 'augmentor',
    augmentorType: 'form',
    formType: 'whirl',
    tier: 1,
    description: 'Whirl form augmentor, creates spiral glyphs',
  },
  {
    id: 'aug-form-condense',
    label: 'Condense',
    svgPath: '/sigils/svg/aug-form-condense.svg',
    textureKey: 'aug-form-condense',
    type: 'augmentor',
    augmentorType: 'form',
    formType: 'condense',
    tier: 1,
    description: 'Condense form augmentor, compresses glyphs',
  },
  {
    id: 'aug-form-compress',
    label: 'Compress',
    svgPath: '/sigils/svg/aug-form-compress.svg',
    textureKey: 'aug-form-compress',
    type: 'augmentor',
    augmentorType: 'form',
    formType: 'compress',
    tier: 1,
    description: 'Compress form augmentor, squeezes glyphs',
  },
];

// Quick lookup map: sigil id → Sigil object
export const sigilLookup: Record<string, Sigil> = Object.fromEntries(
  tier1Sigils.map((s) => [s.id, s])
);
