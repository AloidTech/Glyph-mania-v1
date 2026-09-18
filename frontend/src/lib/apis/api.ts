import { SettingsState } from '../stores/store';
import { supabase } from '../supabase/supabase';
import type { Sigil, GlyphBase } from '../../types/glyph_types';

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
  cover_asset?: string;
  svg_path?: string;
  texture_key: string;
  type: 'effector' | 'augmentor';
  element?: string;
  augmentor_type?: 'position' | 'form';
  form_type?: string;
  coverImageBase64?: string;
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
export async function fetchRemoteSigils() {
  const { data, error } = await supabase
    .from('sigils')
    .select('*')
    .order('tier', { ascending: true });

  if (error) {
    console.error('Error fetching remote sigils:', error);
    return [];
  }

  if (!data) return [];

  return data.map((row: any) => ({
    id: row.id,
    label: row.label,
    type: row.type,
    element: row.element,
    augmentorType: row.augmentor_type,
    formType: row.form_type,
    tier: row.tier || 1,
    description: row.description || '',
    coverAsset: row.svg_path || row.cover_asset || '/sigils/svg/eff-fire.svg',
    svgPath: row.svg_path,
    textureKey: row.texture_key,
    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
    updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : Date.now(),
  }));
}

/**
 * Fetches all glyphs from Supabase and formats them into AdminGlyphItem shape.
 */
export async function fetchRemoteGlyphs() {
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
      } catch (_) {}
    }
  }

  if (error) {
    console.error('Error fetching remote glyphs:', error);
    return [];
  }

  if (!data) return [];

  return data.map((row: any) => ({
    id: row.id,
    name: row.name || 'Unnamed Glyph',
    description: row.description || '',
    tier: row.tier || (row.tier_id ? 1 : 1),
    element: row.element || 'fire',
    coverAsset: row.cover_asset || row.preview_url || '/sigils/svg/eff-fire.svg',
    composition: row.composition || { directions: {}, formAugmentors: {} },
    confidenceScore: row.confidence_score,
    tags: row.tags || [],
    createdAt: row.saved_at ? new Date(row.saved_at).getTime() : Date.now(),
    updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : Date.now(),
  }));
}

