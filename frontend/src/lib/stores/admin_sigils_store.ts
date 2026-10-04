import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { AugmentorType, Element, FormType, SigilKind } from '../../types/glyph_types';
import { generateSigilId } from '../glyph_helpers/sigils';
import { fetchRemoteSigils } from '../apis/api';
import { generateUUID } from '../uuid';
import { supabase } from '../supabase/supabase';

export interface AdminSigilItem {
  id: string;
  label: string;
  type: SigilKind;
  sigilType?: 'effector' | 'form' | 'position';  // NEW
  augmentorType?: AugmentorType;
  element?: Element;
  elementId?: string;  // NEW: FK to elements table  
  formType?: FormType;
  tier: number;
  description: string;
  coverAsset: string; // SVG path, image URL, or data URL
  textureKey?: string;
  baseHitDamage?: number;  // NEW: per-sigil hit damage
  createdAt: number;
  updatedAt: number;
}

export interface AdminSigilsState {
  drafts: Record<string, AdminSigilItem>;
  remoteSigils: AdminSigilItem[];
  sigils: AdminSigilItem[]; // Derived merged array (drafts override remote)
  isLoadingRemote: boolean;

  setRemoteSigils: (sigils: AdminSigilItem[]) => void;
  loadRemoteSigils: () => Promise<AdminSigilItem[]>;
  addSigil: (item: Omit<AdminSigilItem, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => AdminSigilItem;
  updateSigil: (id: string, partial: Partial<Omit<AdminSigilItem, 'id' | 'createdAt'>>) => void;
  deleteSigil: (id: string) => void;
  clearDraft: (id: string) => void; // call this after remote save
  getSigilById: (id: string) => AdminSigilItem | undefined;
  getSigilByLabel: (label: string) => AdminSigilItem | undefined;
  resetToDefaults: () => void;
}

// Hardcoded seed IDs that should no longer be injected as default drafts or foundational sigils
export const hardcodedSeedIds = new Set([
  'eff-fire',
  'eff-water',
  'eff-earth',
  'eff-air',
  'aug-position',
  'aug-form-dash',
  'aug-form-whirl',
  'aug-form-condense',
  'aug-form-compress',
]);

// Self-healing: Purge any bloated remoteSigils or hardcoded seed sigils from localStorage on load
if (typeof window !== 'undefined' && window.localStorage) {
  try {
    const raw = window.localStorage.getItem('glyph-admin-sigils-store');
    if (raw) {
      const parsed = JSON.parse(raw);
      let changed = false;

      // Critical fix: remove bloated remoteSigils array from localStorage to unblock quota
      if (parsed?.state?.remoteSigils) {
        delete parsed.state.remoteSigils;
        changed = true;
      }

      if (parsed?.state?.drafts) {
        for (const id of hardcodedSeedIds) {
          if (parsed.state.drafts[id]) {
            delete parsed.state.drafts[id];
            changed = true;
          }
        }
      }

      if (changed) {
        try {
          window.localStorage.setItem('glyph-admin-sigils-store', JSON.stringify(parsed));
        } catch (setErr) {
          console.warn('[admin_sigils_store] Failed to save sanitized state, clearing key to release quota:', setErr);
          window.localStorage.removeItem('glyph-admin-sigils-store');
        }
      }
    }
  } catch (err) {
    console.warn('[admin_sigils_store] Error inspecting existing localStorage, resetting key:', err);
    try {
      window.localStorage.removeItem('glyph-admin-sigils-store');
    } catch (_) {}
  }
}

// Resilient localStorage adapter that never throws QuotaExceededError
export const safeLocalStorage = {
  getItem: (name: string): string | null => {
    try {
      return typeof window !== 'undefined' ? window.localStorage.getItem(name) : null;
    } catch {
      return null;
    }
  },
  setItem: (name: string, value: string): void => {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(name, value);
      }
    } catch (err) {
      console.warn(`[admin_sigils_store] Quota exceeded or error saving "${name}" to localStorage:`, err);
    }
  },
  removeItem: (name: string): void => {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(name);
      }
    } catch {
      // ignore
    }
  },
};

const initialDrafts: Record<string, AdminSigilItem> = {};

// Helper to merge drafts and remote without any hardcoded seed sigils
const computeMergedSigils = (drafts: Record<string, AdminSigilItem>, remote: AdminSigilItem[]) => {
  const map = new Map<string, AdminSigilItem>();

  // Layer 1: Remote database records
  remote.forEach((s) => map.set(s.id, s));

  // Layer 2: Local drafts override everything (excluding hardcoded seed sigils)
  Object.values(drafts).forEach((s) => {
    if (!hardcodedSeedIds.has(s.id)) {
      map.set(s.id, s);
    }
  });

  return Array.from(map.values());
};

export const useAdminSigilsStore = create<AdminSigilsState>()(
  persist(
    (set, get) => ({
      drafts: initialDrafts,
      remoteSigils: [],
      sigils: [],
      isLoadingRemote: false,

      setRemoteSigils: (remoteSigils) => {
        set((state) => ({
          remoteSigils,
          sigils: computeMergedSigils(state.drafts, remoteSigils)
        }));
      },

      loadRemoteSigils: async () => {
        set({ isLoadingRemote: true });
        try {
          const remoteSigils = await fetchRemoteSigils();
          set((state) => ({
            remoteSigils,
            sigils: computeMergedSigils(state.drafts, remoteSigils),
            isLoadingRemote: false,
          }));
          return remoteSigils;
        } catch (err) {
          set({ isLoadingRemote: false });
          throw err;
        }
      },

      addSigil: (item) => {
        const id = item.id || generateSigilId(item.label, item.type, item.augmentorType);
        const newItem: AdminSigilItem = {
          ...item,
          id,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        set((state) => {
          const newDrafts = { ...state.drafts, [id]: newItem };
          return {
            drafts: newDrafts,
            sigils: computeMergedSigils(newDrafts, state.remoteSigils)
          };
        });

        return newItem;
      },

      updateSigil: (id, partial) => {
        set((state) => {
          // If it doesn't exist in drafts, copy it from remote first
          let existing = state.drafts[id];
          if (!existing) {
            existing = state.remoteSigils.find(s => s.id === id) as AdminSigilItem;
          }
          if (!existing) return state;

          const updated = { ...existing, ...partial, updatedAt: Date.now() };
          const newDrafts = { ...state.drafts, [id]: updated };
          return {
            drafts: newDrafts,
            sigils: computeMergedSigils(newDrafts, state.remoteSigils)
          };
        });
      },

      deleteSigil: (id) => {
        set((state) => {
          const newDrafts = { ...state.drafts };
          delete newDrafts[id];
          return {
            drafts: newDrafts,
            sigils: computeMergedSigils(newDrafts, state.remoteSigils)
          };
        });
      },

      clearDraft: (id) => {
        set((state) => {
          const newDrafts = { ...state.drafts };
          delete newDrafts[id];
          return {
            drafts: newDrafts,
            sigils: computeMergedSigils(newDrafts, state.remoteSigils)
          };
        });
      },

      getSigilById: (id) => {
        return get().sigils.find((s) => s.id === id);
      },

      getSigilByLabel: (label) => {
        const query = label.trim().toLowerCase();
        return get().sigils.find(
          (s) => s.label.toLowerCase() === query || s.id.toLowerCase() === query
        );
      },

      resetToDefaults: () => {
        set({
          drafts: {},
          remoteSigils: [],
          sigils: [],
        });
      },
    }),
    {
      name: 'glyph-admin-sigils-store',
      storage: createJSONStorage(() => safeLocalStorage),
      partialize: (state) => ({ drafts: state.drafts }),
      merge: (persistedState: any, currentState: AdminSigilsState) => {
        const rawDrafts = (persistedState as any)?.drafts || {};
        const cleanDrafts: Record<string, AdminSigilItem> = {};
        for (const [id, item] of Object.entries(rawDrafts)) {
          if (!hardcodedSeedIds.has(id)) {
            cleanDrafts[id] = item as AdminSigilItem;
          }
        }
        return {
          ...currentState,
          drafts: cleanDrafts,
          sigils: computeMergedSigils(cleanDrafts, currentState.remoteSigils),
        };
      },
    }
  )
);

// ===== Supabase Realtime Subscription =====

let sigilsRealtimeChannel: ReturnType<typeof supabase.channel> | null = null;

/**
 * Subscribes to Supabase realtime changes on the `sigils` table.
 * On INSERT/UPDATE/DELETE, refetches the full sigil catalog and updates the store.
 * Call once on app mount. Returns an unsubscribe function.
 */
export function subscribeToRealtimeSigils(): () => void {
  if (sigilsRealtimeChannel) {
    supabase.removeChannel(sigilsRealtimeChannel);
  }

  sigilsRealtimeChannel = supabase
    .channel('sigils-realtime')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'sigils' },
      async (payload) => {
        console.log('[admin_sigils_store] Realtime sigils change:', payload.eventType);
        try {
          await useAdminSigilsStore.getState().loadRemoteSigils();
        } catch (err) {
          console.error('[admin_sigils_store] Failed to reload sigils after realtime event:', err);
        }
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('[admin_sigils_store] Realtime sigils subscription active.');
      } else if (status === 'CHANNEL_ERROR') {
        console.error('[admin_sigils_store] Realtime sigils subscription error.');
      }
    });

  return () => {
    if (sigilsRealtimeChannel) {
      supabase.removeChannel(sigilsRealtimeChannel);
      sigilsRealtimeChannel = null;
    }
  };
}
