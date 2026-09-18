import type { Sigil, EffectorSigil, PositionAugmentorSigil, FormAugmentorSigil } from '../../types/glyph_types';

export interface GenericSigilLike {
  id: string;
  label: string;
  type: 'effector' | 'augmentor';
  augmentorType?: 'position' | 'form' | string;
  formType?: string;
  element?: string;
  tier?: number;
  description?: string;
  coverAsset?: string;
  svgPath?: string;
  textureKey?: string;
}

// ===== Foundational / System Sigil Catalog =====
export const FOUNDATIONAL_SIGILS: Sigil[] = [
  {
    id: 'eff-fire',
    label: 'Fire',
    type: 'effector',
    element: 'fire',
    tier: 1,
    description: 'Deals direct thermal flame damage upon projectile or beam impact.',
    svgPath: '/sigils/svg/eff-fire.svg',
    textureKey: 'eff-fire',
  },
  {
    id: 'eff-water',
    label: 'Water',
    type: 'effector',
    element: 'water',
    tier: 1,
    description: 'Surges with kinetic hydro energy, cooling and extinguishing heat.',
    svgPath: '/sigils/svg/eff-water.svg',
    textureKey: 'eff-water',
  },
  {
    id: 'eff-earth',
    label: 'Earth',
    type: 'effector',
    element: 'earth',
    tier: 1,
    description: 'Manifests solid geological mass and crushing impact force.',
    svgPath: '/sigils/svg/eff-earth.svg',
    textureKey: 'eff-earth',
  },
  {
    id: 'eff-air',
    label: 'Air',
    type: 'effector',
    element: 'air',
    tier: 1,
    description: 'Harnesses high-velocity wind pressure and atmospheric repulsion.',
    svgPath: '/sigils/svg/eff-air.svg',
    textureKey: 'eff-air',
  },
  {
    id: 'aug-position',
    label: 'Position',
    type: 'augmentor',
    augmentorType: 'position',
    tier: 1,
    description: 'Cardinal spatial anchor aligning projection across North, East, South, or West.',
    svgPath: '/sigils/svg/aug-position.svg',
    textureKey: 'aug-position',
  },
  {
    id: 'aug-form-dash',
    label: 'Dash',
    type: 'augmentor',
    augmentorType: 'form',
    formType: 'dash',
    tier: 1,
    description: 'Linear burst augmentor propelling linear strikes and focused dashes.',
    svgPath: '/sigils/svg/aug-form-dash.svg',
    textureKey: 'aug-form-dash',
  },
  {
    id: 'aug-form-whirl',
    label: 'Whirl',
    type: 'augmentor',
    augmentorType: 'form',
    formType: 'whirl',
    tier: 1,
    description: 'Vortex rotational augmentor generating circular radial discharge.',
    svgPath: '/sigils/svg/aug-form-whirl.svg',
    textureKey: 'aug-form-whirl',
  },
  {
    id: 'aug-form-condense',
    label: 'Condense',
    type: 'augmentor',
    augmentorType: 'form',
    formType: 'condense',
    tier: 1,
    description: 'Compression augmentor focusing arcane mass into an implosive nexus.',
    svgPath: '/sigils/svg/aug-form-condense.svg',
    textureKey: 'aug-form-condense',
  },
  {
    id: 'aug-form-compress',
    label: 'Compress',
    type: 'augmentor',
    augmentorType: 'form',
    formType: 'compress',
    tier: 1,
    description: 'High-density augmentor packing elemental power for delayed detonation.',
    svgPath: '/sigils/svg/aug-form-compress.svg',
    textureKey: 'aug-form-compress',
  },
];

// Fallback lookup dictionary
export const sigilLookup: Record<string, Sigil> = FOUNDATIONAL_SIGILS.reduce(
  (acc, s) => {
    acc[s.id] = s;
    return acc;
  },
  {} as Record<string, Sigil>
);

export const tier1Sigils: Sigil[] = FOUNDATIONAL_SIGILS;

/**
 * Universal Canonical Sigil Resolver
 * Resolves any identifier, label, legacy ID, cardinal alias, or element name
 * to a concrete Sigil or AdminSigilItem from the given pool (or system defaults).
 */
export function resolveCanonicalSigil<T extends GenericSigilLike = GenericSigilLike>(
  identifier?: string | null,
  pool?: T[] | Record<string, T>
): T | Sigil | undefined {
  if (!identifier) return undefined;

  const rawList: (T | Sigil)[] = pool
    ? Array.isArray(pool)
      ? pool
      : Object.values(pool)
    : [];

  const candidates: (T | Sigil)[] = pool !== undefined ? rawList : FOUNDATIONAL_SIGILS;
  const query = identifier.trim().toLowerCase();

  // 1. Direct ID match (case-sensitive and case-insensitive)
  let matched = candidates.find((s) => s.id === identifier || s.id.toLowerCase() === query);
  if (matched) return matched;

  // 2. Direct Label match
  matched = candidates.find((s) => s.label && s.label.toLowerCase() === query);
  if (matched) return matched;

  // 3. Cardinal Direction / Position Augmentor Aliases
  const isPositionAlias =
    query === 'position' ||
    query === 'aug-position' ||
    query === 'position anchor' ||
    query === 'cardinal' ||
    query === 'direction' ||
    query === 'top' ||
    query === 'bottom' ||
    query === 'left' ||
    query === 'right' ||
    query.includes('north') ||
    query.includes('south') ||
    query.includes('east') ||
    query.includes('west') ||
    query.includes('anchor');

  if (isPositionAlias) {
    matched = candidates.find(
      (s) => s.type === 'augmentor' && ('augmentorType' in s && s.augmentorType === 'position')
    );
    if (matched) return matched;
  }

  // 4. Effector Element Aliases
  if (query === 'fire' || query === 'eff-fire' || query.includes('fire effector')) {
    matched = candidates.find(
      (s) => s.type === 'effector' && ('element' in s && s.element === 'fire')
    );
    if (matched) return matched;
  }
  if (query === 'water' || query === 'eff-water' || query.includes('water effector')) {
    matched = candidates.find(
      (s) => s.type === 'effector' && ('element' in s && s.element === 'water')
    );
    if (matched) return matched;
  }
  if (query === 'earth' || query === 'eff-earth' || query.includes('earth effector')) {
    matched = candidates.find(
      (s) => s.type === 'effector' && ('element' in s && s.element === 'earth')
    );
    if (matched) return matched;
  }
  if (query === 'air' || query === 'eff-air' || query.includes('air effector')) {
    matched = candidates.find(
      (s) => s.type === 'effector' && ('element' in s && s.element === 'air')
    );
    if (matched) return matched;
  }

  // 5. Form Augmentor Aliases
  if (query === 'dash' || query === 'aug-form-dash' || query.includes('dash')) {
    matched = candidates.find(
      (s) => s.type === 'augmentor' && (('formType' in s && s.formType === 'dash') || s.label?.toLowerCase() === 'dash')
    );
    if (matched) return matched;
  }
  if (query === 'whirl' || query === 'aug-form-whirl' || query.includes('whirl')) {
    matched = candidates.find(
      (s) => s.type === 'augmentor' && (('formType' in s && s.formType === 'whirl') || s.label?.toLowerCase() === 'whirl')
    );
    if (matched) return matched;
  }
  if (query === 'condense' || query === 'aug-form-condense' || query.includes('condense')) {
    matched = candidates.find(
      (s) => s.type === 'augmentor' && (('formType' in s && s.formType === 'condense') || s.label?.toLowerCase() === 'condense')
    );
    if (matched) return matched;
  }
  if (query === 'compress' || query === 'aug-form-compress' || query.includes('compress')) {
    matched = candidates.find(
      (s) => s.type === 'augmentor' && (('formType' in s && s.formType === 'compress') || s.label?.toLowerCase() === 'compress')
    );
    if (matched) return matched;
  }

  return undefined;
}

/**
 * Resolves any label/symbol string to the canonical database or system ID.
 * Returns the resolved sigil's ID if found, or undefined if unresolvable.
 */
export function resolveSigilIdToDatabaseId<T extends GenericSigilLike = GenericSigilLike>(
  identifier?: string | null,
  pool?: T[] | Record<string, T>
): string | undefined {
  if (!identifier) return undefined;
  const sigil = resolveCanonicalSigil(identifier, pool);
  return sigil ? sigil.id : undefined;
}

/**
 * Generates a semantic, name-based Sigil ID
 */
export function generateSigilId(
  label: string,
  type?: 'effector' | 'augmentor' | string,
  augmentorType?: 'position' | 'form' | string
): string {
  const clean = label.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const suffix = Date.now().toString(36).slice(-4);
  const base = clean || 'sigil';

  if (type === 'effector') {
    return `eff-${base}-${suffix}`;
  }
  if (type === 'augmentor') {
    if (augmentorType === 'form') return `aug-form-${base}-${suffix}`;
    if (augmentorType === 'position') return `aug-pos-${base}-${suffix}`;
    return `aug-${base}-${suffix}`;
  }
  return `sigil-${base}-${suffix}`;
}
