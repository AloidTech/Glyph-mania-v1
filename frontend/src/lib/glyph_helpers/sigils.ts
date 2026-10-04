import type { Sigil, EffectorSigil, PositionAugmentorSigil, FormAugmentorSigil, Element } from '../../types/glyph_types';
import { useAdminSigilsStore } from '../stores/admin_sigils_store';

export interface GenericSigilLike {
  id: string;
  label: string;
  type: 'effector' | 'augmentor';  // keep for backwards compat
  sigilType?: 'effector' | 'form' | 'position';  // NEW: unified type
  augmentorType?: 'position' | 'form' | string;   // keep for backwards compat
  formType?: string;
  element?: string;
  elementId?: string;  // NEW: FK to elements table
  tier?: number;
  description?: string;
  coverAsset?: string;
  textureKey?: string;
  baseHitDamage?: number;  // NEW: per-sigil hit damage
}

/**
 * Retrieves the Element of a sigil by looking it up strictly via its ID.
 * If a pool is provided, searches the pool; otherwise queries the central admin sigils store.
 */
export function getSigilElement(
  sigilId: string | null | undefined,
  pool?: (Sigil | GenericSigilLike)[] | Record<string, Sigil | GenericSigilLike>
): Element | undefined {
  if (!sigilId) return undefined;

  if (pool) {
    const candidates: (Sigil | GenericSigilLike)[] = Array.isArray(pool) ? pool : Object.values(pool);
    const matched = candidates.find((s) => s.id === sigilId);
    if (matched && 'element' in matched && matched.element) {
      return matched.element as Element;
    }
    return undefined;
  }

  const matched = useAdminSigilsStore.getState().getSigilById(sigilId);
  return (matched?.element as Element) || undefined;
}

/**
 * Universal Canonical Sigil Resolver
 * Resolves any identifier, label, legacy ID, cardinal alias, or element name
 * to a concrete Sigil or AdminSigilItem from the given pool.
 * Pool is required — the resolver never falls back to hardcoded data.
 */
export function resolveCanonicalSigil<T extends GenericSigilLike = GenericSigilLike>(
  identifier: string | null | undefined,
  pool: T[] | Record<string, T>
): T | Sigil | undefined {
  if (!identifier) return undefined;

  const candidates: (T | Sigil)[] = Array.isArray(pool)
    ? pool
    : Object.values(pool);
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
      (s) => (s.type === 'augmentor' && ('augmentorType' in s && s.augmentorType === 'position')) || ('sigilType' in s && s.sigilType === 'position')
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
      (s) => (s.type === 'augmentor' || ('sigilType' in s && s.sigilType === 'form')) && (('formType' in s && s.formType === 'dash') || s.label?.toLowerCase() === 'dash')
    );
    if (matched) return matched;
  }
  if (query === 'whirl' || query === 'aug-form-whirl' || query.includes('whirl')) {
    matched = candidates.find(
      (s) => (s.type === 'augmentor' || ('sigilType' in s && s.sigilType === 'form')) && (('formType' in s && s.formType === 'whirl') || s.label?.toLowerCase() === 'whirl')
    );
    if (matched) return matched;
  }
  if (query === 'condense' || query === 'aug-form-condense' || query.includes('condense')) {
    matched = candidates.find(
      (s) => (s.type === 'augmentor' || ('sigilType' in s && s.sigilType === 'form')) && (('formType' in s && s.formType === 'condense') || s.label?.toLowerCase() === 'condense')
    );
    if (matched) return matched;
  }
  if (query === 'compress' || query === 'aug-form-compress' || query.includes('compress')) {
    matched = candidates.find(
      (s) => (s.type === 'augmentor' || ('sigilType' in s && s.sigilType === 'form')) && (('formType' in s && s.formType === 'compress') || s.label?.toLowerCase() === 'compress')
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
  identifier: string | null | undefined,
  pool: T[] | Record<string, T>
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

/**
 * Returns true if the ID follows the standard semantic format (eff-*, aug-*, sigil-*).
 * UUIDs and other formats return false.
 */
export function isSemanticSigilId(id: string): boolean {
  return /^(eff|aug|aug-form|aug-pos|sigil)-[a-z0-9]/.test(id);
}

/**
 * Builds a deterministic, standard-format sigil ID from a sigil's properties.
 * Unlike `generateSigilId`, this produces a stable ID (no timestamp suffix)
 * for well-known/foundational sigils, and a suffixed one for custom sigils.
 *
 * @param label   - Sigil label (e.g. "Fire", "Dash")
 * @param type    - 'effector' | 'augmentor'
 * @param augmentorType - 'position' | 'form' (only for augmentors)
 * @param options - { stable: true } to omit timestamp suffix (for foundational re-keying)
 */
export function buildStandardSigilId(
  label: string,
  type: 'effector' | 'augmentor' | string,
  augmentorType?: 'position' | 'form' | string,
  options?: { stable?: boolean }
): string {
  const clean = label.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const base = clean || 'sigil';
  const suffix = options?.stable ? '' : `-${Date.now().toString(36).slice(-4)}`;

  if (type === 'effector') {
    return `eff-${base}${suffix}`;
  }
  if (type === 'augmentor') {
    if (augmentorType === 'form') return `aug-form-${base}${suffix}`;
    if (augmentorType === 'position') return `aug-pos-${base}${suffix}`;
    return `aug-${base}${suffix}`;
  }
  return `sigil-${base}${suffix}`;
}

/**
 * Batch migration: finds all sigils with non-semantic IDs (e.g. UUIDs) and re-keys
 * them in the database to the standard semantic format.
 *
 * This updates:
 *   - `sigils.id`
 *   - `training_examples.sigil_id` (foreign key)
 *
 * Returns a summary of what was changed.
 */
export async function standardizeSigilIds(
  supabase: { from: (table: string) => any },
  sigils: { id: string; label: string; type: string; augmentorType?: string }[]
): Promise<{ updated: { oldId: string; newId: string }[]; errors: string[] }> {
  const updated: { oldId: string; newId: string }[] = [];
  const errors: string[] = [];

  const nonSemanticSigils = sigils.filter((s) => !isSemanticSigilId(s.id));

  if (nonSemanticSigils.length === 0) {
    return { updated, errors };
  }

  // Collect all existing semantic IDs to avoid collisions
  const existingIds = new Set(sigils.map((s) => s.id));

  for (const sigil of nonSemanticSigils) {
    const oldId = sigil.id;
    let newId = buildStandardSigilId(sigil.label, sigil.type, sigil.augmentorType, { stable: true });

    // If the stable ID already exists, add a suffix to make it unique
    if (existingIds.has(newId) && newId !== oldId) {
      newId = buildStandardSigilId(sigil.label, sigil.type, sigil.augmentorType);
    }

    if (newId === oldId) continue;
    if (existingIds.has(newId)) {
      errors.push(`Cannot re-key "${oldId}" → "${newId}": ID already exists.`);
      continue;
    }

    try {
      // 1. Update training_examples foreign key first (CASCADE won't auto-update on renames)
      const { error: examplesError } = await supabase
        .from('training_examples')
        .update({ sigil_id: newId })
        .eq('sigil_id', oldId);

      if (examplesError) {
        errors.push(`Failed to update training_examples for "${oldId}": ${examplesError.message}`);
        continue;
      }

      // 2. Insert new sigil row with the new ID, then delete old one (Supabase doesn't support PK updates)
      const { data: existing, error: fetchErr } = await supabase
        .from('sigils')
        .select('*')
        .eq('id', oldId)
        .single();

      if (fetchErr || !existing) {
        errors.push(`Failed to fetch sigil "${oldId}": ${fetchErr?.message ?? 'not found'}`);
        continue;
      }

      const cleanRecord = { ...existing, id: newId };
      delete (cleanRecord as any).svg_path;

      const { error: insertErr } = await supabase
        .from('sigils')
        .insert([cleanRecord]);

      if (insertErr) {
        // Rollback training_examples
        await supabase.from('training_examples').update({ sigil_id: oldId }).eq('sigil_id', newId);
        errors.push(`Failed to insert new sigil "${newId}": ${insertErr.message}`);
        continue;
      }

      const { error: deleteErr } = await supabase
        .from('sigils')
        .delete()
        .eq('id', oldId);

      if (deleteErr) {
        errors.push(`Inserted "${newId}" but failed to delete old "${oldId}": ${deleteErr.message}`);
      }

      existingIds.add(newId);
      existingIds.delete(oldId);
      updated.push({ oldId, newId });
    } catch (err) {
      errors.push(`Unexpected error re-keying "${oldId}": ${err}`);
    }
  }

  return { updated, errors };
}
