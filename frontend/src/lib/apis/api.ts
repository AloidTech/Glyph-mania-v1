import { SettingsState } from '../stores/store';
import { supabase } from '../supabase/supabase';
import type { AdminSigilItem } from '../stores/admin_sigils_store';
import type { AdminGlyphItem } from '../stores/admin_glyphs_store';
import type { ElementItem, ElementEffectItem } from '../stores/elements_store';
import type { TrainingExample } from '../../types/training_types';
import type { EffectDefinition } from '../../types/phenomenon_types';

const API_BASE = '/api';

export async function fetchSettingsApi(): Promise<SettingsState | null> {
  try {
    const res = await fetch(`${API_BASE}/settings`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.success ? data.settings : null;
  } catch {
    return null;
  }
}

export async function updateSettingsApi(partial: Partial<SettingsState>): Promise<SettingsState | null> {
  try {
    const res = await fetch(`${API_BASE}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(partial)
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.success ? data.settings : null;
  } catch {
    return null;
  }
}

// --- Supabase Data Fetching & Edge Function Helpers ---

export interface SaveGlyphPayload {
  id?: string;
  name: string;
  description: string;
  element: string;
  tier: number;
  isPublic: boolean;
  composition: any;
  coverImageBase64?: string;
}

export interface CreateSigilPayload {
  id?: string;
  label: string;
  description: string;
  tier: number;
  coverAsset?: string;
  cover_asset?: string;
  texture_key: string;
  type?: 'effector' | 'augmentor';
  sigil_type?: 'effector' | 'form' | 'position';
  element?: string;
  element_id?: string;
  augmentor_type?: 'position' | 'form';
  form_type?: string;
  base_hit_damage?: number;
  coverImageBase64?: string;
}

export interface CheckSolidityPayload {
  tier?: number;
  composition: any;
  element?: string;
  accuracies?: Record<string, number>;
}

export interface BackendSolidityResponse {
  isSolid: boolean;
  slots: {
    effector: boolean;
    directions: { top: boolean; right: boolean; bottom: boolean; left: boolean };
    formAugmentors: { topLeft: boolean; topRight: boolean; bottomLeft: boolean; bottomRight: boolean };
  };
  reasons: string[];
  formType: string | null;
  lowAccuracySlots: string[];
  accuracies: Record<string, number>;
  slotErrors: Record<string, Array<{ type: string; message: string }>>;
}

/**
 * Validates glyph solidity against the backend Edge Function using live database sigils.
 * Strictly surfaces errors with descriptive messages rather than failing silently.
 */
export async function checkGlyphSolidityApi(payload: CheckSolidityPayload): Promise<BackendSolidityResponse> {
  if (!payload || !payload.composition) {
    throw new Error('Backend solidity check requires a valid glyph composition.');
  }

  const { data, error } = await supabase.functions.invoke('check-solidity', {
    body: payload,
  });

  if (error) {
    let errorMsg = error.message;
    if ((error as any).context?.json) {
      try {
        const body = await (error as any).context.json();
        if (body?.error) errorMsg = body.error;
      } catch { }
    }
    throw new Error(errorMsg || 'Failed to check glyph solidity via backend edge function');
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  if (!data?.data) {
    throw new Error('Backend returned empty or invalid solidity analysis payload.');
  }

  return data.data as BackendSolidityResponse;
}

/**
 * Invokes the 'save-glyph' Edge Function to securely validate and persist a glyph.
 */
export async function saveGlyphApi(payload: SaveGlyphPayload) {
  const { data, error } = await supabase.functions.invoke('save-glyph', {
    body: payload,
  });

  if (error) {
    // If Edge function returned an error payload
    let errorMsg = error.message;
    if ((error as any).context?.json) {
      try {
        const body = await (error as any).context.json();
        if (body?.error) errorMsg = body.error;
      } catch { }
    }
    throw new Error(errorMsg || 'Failed to save glyph via edge function');
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data?.data || data;
}

/**
 * Invokes the 'create-sigil' Edge Function to validate and register a sigil.
 */
export async function createSigilApi(payload: CreateSigilPayload) {
  const { data, error } = await supabase.functions.invoke('create-sigil', {
    body: payload,
  });

  if (error) {
    let errorMsg = error.message;
    if ((error as any).context?.json) {
      try {
        const body = await (error as any).context.json();
        if (body?.error) errorMsg = body.error;
      } catch { }
    }
    throw new Error(errorMsg || 'Failed to create sigil via edge function');
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data?.data || data;
}

/**
 * Fetches all sigils from Supabase and formats them into AdminSigilItem shape.
 */
export async function fetchRemoteSigils(): Promise<AdminSigilItem[]> {
  const { data, error } = await supabase
    .from('sigils')
    .select('*')
    .order('tier', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch sigils from database: ${error.message}`);
  }

  if (!data) {
    throw new Error('Sigils query returned no data — database may be unreachable.');
  }

  return data.map((row: any) => ({
    id: row.id,
    label: row.label,
    type: row.type,
    sigilType: row.sigil_type,
    element: row.element,
    elementId: row.element_id,
    augmentorType: row.augmentor_type,
    formType: row.form_type,
    tier: row.tier || 1,
    description: row.description || '',
    coverAsset: row.cover_asset || '/sigils/svg/eff-fire.svg',
    textureKey: row.texture_key,
    baseHitDamage: row.base_hit_damage ?? 100,
    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
    updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : Date.now(),
  }));
}

/**
 * Fetches all glyphs from Supabase and formats them into AdminGlyphItem shape.
 */
export async function fetchRemoteGlyphs(): Promise<AdminGlyphItem[]> {
  let { data, error } = await supabase
    .from('glyphs')
    .select('*')
    .order('saved_at', { ascending: false });

  if (error) {
    if ((error as any).code === 'PGRST303') {
      console.warn(
        'Clock skew detected with Supabase server (PGRST303: JWT issued at future). ' +
        'Please synchronize your system clock (Windows Settings -> Time & Language -> Date & Time -> "Sync now"). ' +
        'Attempting session refresh...'
      );
      try {
        await supabase.auth.refreshSession();
        const retry = await supabase
          .from('glyphs')
          .select('*')
          .order('saved_at', { ascending: false });
        if (!retry.error && retry.data) {
          data = retry.data;
          error = null;
        }
      } catch (refreshErr) {
        throw new Error(`Failed to refresh Supabase session after clock skew: ${refreshErr}`);
      }
    }
  }

  if (error) {
    throw new Error(`Failed to fetch glyphs from database: ${error.message}`);
  }

  if (!data) {
    throw new Error('Glyphs query returned no data — database may be unreachable.');
  }

  return data.map((row: any) => ({
    id: row.id,
    name: row.name || 'Unnamed Glyph',
    description: row.description || '',
    tier: row.tier || 1,
    element: row.element || 'fire',
    coverAsset: row.cover_asset || row.preview_url || '/sigils/svg/eff-fire.svg',
    composition: row.composition || { directions: {}, formAugmentors: {} },
    confidenceScore: row.confidence_score,
    tags: row.tags || [],
    createdAt: row.saved_at ? new Date(row.saved_at).getTime() : Date.now(),
    updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : Date.now(),
  }));
}

export const DEFAULT_STARTER_ELEMENTS: ElementItem[] = [
  { id: 'FIRE', label: 'Fire', primaryColor: '#ef4444', secondaryColor: '#f97316', particleVfxKey: 'fire_particles', baseHitDamage: 100 },
  { id: 'WATER', label: 'Water', primaryColor: '#0077be', secondaryColor: '#0066aa', particleVfxKey: 'water_particles', baseHitDamage: 80 },
  { id: 'EARTH', label: 'Earth', primaryColor: '#784421', secondaryColor: '#8b5a2b', particleVfxKey: 'earth_particles', baseHitDamage: 120 },
  { id: 'AIR', label: 'Air', primaryColor: '#d8efff', secondaryColor: '#e0f2fe', particleVfxKey: 'air_particles', baseHitDamage: 60 },
];

export const DEFAULT_STARTER_EFFECTS: ElementEffectItem[] = [
  // FIRE
  { id: 1, elementId: 'FIRE', effectType: 'BURNING', baseTickDamage: 12, intervalTicks: 5, durationTicks: 40, baseMagnitude: null },
  { id: 2, elementId: 'FIRE', effectType: 'IGNITE', baseTickDamage: 25, intervalTicks: 3, durationTicks: 15, baseMagnitude: null },
  { id: 3, elementId: 'FIRE', effectType: 'MELT_ARMOR', baseTickDamage: 0, intervalTicks: 10, durationTicks: 60, baseMagnitude: 0.20 },
  // WATER
  { id: 4, elementId: 'WATER', effectType: 'SLOW', baseTickDamage: 0, intervalTicks: 5, durationTicks: 30, baseMagnitude: 0.35 },
  { id: 5, elementId: 'WATER', effectType: 'CHILL', baseTickDamage: 6, intervalTicks: 8, durationTicks: 30, baseMagnitude: 0.15 },
  { id: 6, elementId: 'WATER', effectType: 'DRENCH', baseTickDamage: 0, intervalTicks: 10, durationTicks: 50, baseMagnitude: 0.25 },
  { id: 7, elementId: 'WATER', effectType: 'FREEZE', baseTickDamage: 0, intervalTicks: 1, durationTicks: 20, baseMagnitude: 1.00 },
  // EARTH
  { id: 8, elementId: 'EARTH', effectType: 'STAGGER', baseTickDamage: 0, intervalTicks: 1, durationTicks: 5, baseMagnitude: 0.80 },
  { id: 9, elementId: 'EARTH', effectType: 'CRUSH', baseTickDamage: 18, intervalTicks: 6, durationTicks: 24, baseMagnitude: null },
  { id: 10, elementId: 'EARTH', effectType: 'PETRIFY', baseTickDamage: 0, intervalTicks: 1, durationTicks: 25, baseMagnitude: 1.00 },
  { id: 11, elementId: 'EARTH', effectType: 'TREMOR', baseTickDamage: 5, intervalTicks: 4, durationTicks: 20, baseMagnitude: 0.20 },
  // AIR
  { id: 12, elementId: 'AIR', effectType: 'KNOCKBACK', baseTickDamage: 0, intervalTicks: 1, durationTicks: 3, baseMagnitude: 0.60 },
  { id: 13, elementId: 'AIR', effectType: 'BLEED_LACERATE', baseTickDamage: 10, intervalTicks: 3, durationTicks: 30, baseMagnitude: null },
  { id: 14, elementId: 'AIR', effectType: 'VORTEX_PULL', baseTickDamage: 0, intervalTicks: 2, durationTicks: 20, baseMagnitude: 0.40 },
  { id: 15, elementId: 'AIR', effectType: 'SILENCE_DISRUPT', baseTickDamage: 0, intervalTicks: 5, durationTicks: 20, baseMagnitude: null },
];

export interface SigilEffectOverride {
  sigilId: string;
  effectType: string;
  tickDamageMult: number;
  durationTicksOverride: number | null;
  intervalTicksOverride: number | null;
  isExcluded: boolean;
}

/**
 * Fetches elements and their effects from Supabase with starter defaults fallback.
 */
export async function fetchElements(): Promise<{ elements: ElementItem[]; effects: ElementEffectItem[] }> {
  try {
    const [elementsRes, effectsRes] = await Promise.all([
      supabase.from('elements').select('*').order('id', { ascending: true }),
      supabase.from('element_effects').select('*').order('id', { ascending: true }),
    ]);

    if (elementsRes.error || !elementsRes.data || elementsRes.data.length === 0) {
      console.warn('[api] Elements table empty or unreachable, using starter defaults.');
      return { elements: DEFAULT_STARTER_ELEMENTS, effects: DEFAULT_STARTER_EFFECTS };
    }

    const elements: ElementItem[] = elementsRes.data.map((row: any) => ({
      id: row.id,
      label: row.label,
      primaryColor: row.primary_color,
      secondaryColor: row.secondary_color,
      particleVfxKey: row.particle_vfx_key,
      baseHitDamage: row.base_hit_damage,
    }));

    const rawEffects = effectsRes.data || [];
    const effects: ElementEffectItem[] = rawEffects.length > 0
      ? rawEffects.map((row: any) => ({
          id: row.id,
          elementId: row.element_id,
          effectType: row.effect_type,
          baseTickDamage: row.base_tick_damage,
          intervalTicks: row.interval_ticks,
          durationTicks: row.duration_ticks,
          baseMagnitude: row.base_magnitude,
        }))
      : DEFAULT_STARTER_EFFECTS;

    return { elements, effects };
  } catch (err) {
    console.warn('[api] Error fetching elements from Supabase, using starter defaults:', err);
    return { elements: DEFAULT_STARTER_ELEMENTS, effects: DEFAULT_STARTER_EFFECTS };
  }
}

/**
 * Fetches sigil effect overrides from database.
 */
export async function fetchSigilEffectOverrides(sigilId: string): Promise<SigilEffectOverride[]> {
  try {
    const { data, error } = await supabase
      .from('sigil_effect_overrides')
      .select('*')
      .eq('sigil_id', sigilId);

    if (error) {
      console.warn(`[api] fetchSigilEffectOverrides error for ${sigilId}:`, error);
      return [];
    }

    return (data || []).map((row: any) => ({
      sigilId: row.sigil_id,
      effectType: row.effect_type,
      tickDamageMult: Number(row.tick_damage_mult ?? 1.0),
      durationTicksOverride: row.duration_ticks_override ?? null,
      intervalTicksOverride: row.interval_ticks_override ?? null,
      isExcluded: Boolean(row.is_excluded),
    }));
  } catch {
    return [];
  }
}

/**
 * Saves sigil effect overrides to database.
 */
export async function saveSigilEffectOverrides(overrides: SigilEffectOverride[]): Promise<void> {
  if (overrides.length === 0) return;
  const dbRows = overrides.map((ov) => ({
    sigil_id: ov.sigilId,
    effect_type: ov.effectType,
    tick_damage_mult: ov.tickDamageMult,
    duration_ticks_override: ov.durationTicksOverride,
    interval_ticks_override: ov.intervalTicksOverride,
    is_excluded: ov.isExcluded,
  }));
  const { error } = await supabase
    .from('sigil_effect_overrides')
    .upsert(dbRows, { onConflict: 'sigil_id,effect_type' });

  if (error) {
    console.error('[api] saveSigilEffectOverrides error:', error);
    throw error;
  }
}

/**
 * Resolves all inherited elemental effects for a given sigil using the database RPC.
 */
export async function fetchResolvedEffects(sigilId: string) {
  const { data, error } = await supabase.rpc('resolve_sigil_effects', { p_sigil_id: sigilId });
  if (error) throw new Error(error.message);
  return data;
}

/**
 * Fetches all training examples from Supabase database table.
 */
export async function fetchRemoteTrainingExamples(): Promise<TrainingExample[]> {
  const { data, error } = await supabase
    .from('training_examples')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch training examples: ${error.message}`);
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    sigilId: row.sigil_id,
    vec: Array.isArray(row.vec) ? row.vec : [],
    thumb: row.thumb,
    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
    modelIds: row.model_ids || [],
    synced: true,
  }));
}

/**
 * Fetches all master effect definitions from Supabase.
 */
export async function fetchMasterEffects(): Promise<EffectDefinition[]> {
  try {
    const { data, error } = await supabase
      .from('effects')
      .select('*')
      .order('id', { ascending: true });

    if (error) {
      console.warn('[api] fetchMasterEffects DB error:', error);
      return [];
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      label: row.label,
      category: row.category,
      targetStat: row.target_stat,
      modifierType: row.modifier_type,
      defaultMagnitude: row.default_magnitude !== null ? Number(row.default_magnitude) : null,
      baseTickDamage: row.base_tick_damage !== null ? Number(row.base_tick_damage) : 0,
      defaultIntervalTicks: Number(row.default_interval_ticks) || 5,
      defaultDurationTicks: Number(row.default_duration_ticks) || 40,
      description: row.description || '',
      createdAt: row.created_at,
    }));
  } catch (err) {
    console.error('[api] Failed to fetch master effects:', err);
    return [];
  }
}

/**
 * Creates or updates a master effect definition in Supabase.
 */
export async function saveMasterEffect(effect: EffectDefinition): Promise<void> {
  const payload = {
    id: effect.id.trim().toUpperCase(),
    label: effect.label.trim(),
    category: effect.category,
    target_stat: effect.category === 'STAT_MOD' ? effect.targetStat : null,
    modifier_type: effect.category === 'STAT_MOD' ? effect.modifierType : null,
    default_magnitude: effect.category === 'STAT_MOD' && effect.defaultMagnitude !== null && !isNaN(Number(effect.defaultMagnitude)) ? Number(effect.defaultMagnitude) : null,
    base_tick_damage: effect.category === 'DOT' ? (Number(effect.baseTickDamage) || 0) : 0,
    default_interval_ticks: Math.max(1, Number(effect.defaultIntervalTicks) || 5),
    default_duration_ticks: Math.max(1, Number(effect.defaultDurationTicks) || 40),
    description: effect.description?.trim() || '',
  };

  const { error } = await supabase
    .from('effects')
    .upsert(payload, { onConflict: 'id' });

  if (error) {
    console.error('[api] saveMasterEffect error:', error);
    throw error;
  }
}

/**
 * Deletes a master effect definition from Supabase.
 */
export async function deleteMasterEffect(effectId: string): Promise<void> {
  const { error } = await supabase
    .from('effects')
    .delete()
    .eq('id', effectId);

  if (error) {
    console.error('[api] deleteMasterEffect error:', error);
    throw error;
  }
}

