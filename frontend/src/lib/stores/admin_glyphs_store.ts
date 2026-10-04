import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Element, GlyphComposition } from '../../types/glyph_types';
import { fetchRemoteGlyphs } from '../apis/api';
import { generateUUID } from '../uuid';
import { supabase } from '../supabase/supabase';

import type { StrokeData } from 'atrament';

export type AdminGlyphComposition = GlyphComposition;

export interface AdminGlyphItem {
  id: string;
  name: string;
  description: string;
  tier: number;
  element?: Element;
  coverAsset?: string;
  composition: AdminGlyphComposition;
  confidenceScore?: number;
  tags?: string[];
  createdAt: number;
  updatedAt: number;
}

export interface AdminGlyphsState {
  drafts: Record<string, AdminGlyphItem>;
  remoteGlyphs: AdminGlyphItem[];
  glyphs: AdminGlyphItem[]; // Derived merged array (drafts override remote)
  isLoadingRemote: boolean;

  setRemoteGlyphs: (glyphs: AdminGlyphItem[]) => void;
  loadRemoteGlyphs: () => Promise<AdminGlyphItem[]>;
  addGlyph: (item: Omit<AdminGlyphItem, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => AdminGlyphItem;
  updateGlyph: (id: string, partial: Partial<Omit<AdminGlyphItem, 'id' | 'createdAt'>>) => void;
  deleteGlyph: (id: string) => void;
  clearDraft: (id: string) => void; // call this after remote save
  getGlyphById: (id: string) => AdminGlyphItem | undefined;
  resetToDefaults: () => void;
}


// Helper to merge drafts and remote
const computeMergedGlyphs = (drafts: Record<string, AdminGlyphItem>, remote: AdminGlyphItem[]) => {
  const merged = [...remote];
  const remoteIds = new Set(remote.map(r => r.id));

  Object.values(drafts).forEach(draft => {
    if (remoteIds.has(draft.id)) {
      // Replace remote with draft
      const index = merged.findIndex(r => r.id === draft.id);
      if (index !== -1) merged[index] = draft;
    } else {
      // It's a new unsaved draft
      merged.push(draft);
    }
  });
  return merged;
};

export const useAdminGlyphsStore = create<AdminGlyphsState>()(
  persist(
    (set, get) => ({
      drafts: {},
      remoteGlyphs: [],
      glyphs: [],
      isLoadingRemote: false,

      setRemoteGlyphs: (remoteGlyphs) => {
        set((state) => ({
          remoteGlyphs,
          glyphs: computeMergedGlyphs(state.drafts, remoteGlyphs)
        }));
      },

      loadRemoteGlyphs: async () => {
        set({ isLoadingRemote: true });
        try {
          const remoteGlyphs = await fetchRemoteGlyphs();
          set((state) => ({
            remoteGlyphs,
            glyphs: computeMergedGlyphs(state.drafts, remoteGlyphs),
            isLoadingRemote: false,
          }));
          return remoteGlyphs;
        } catch (err) {
          set({ isLoadingRemote: false });
          throw err;
        }
      },

      addGlyph: (item) => {
        const id = item.id || generateUUID();
        const newItem: AdminGlyphItem = {
          ...item,
          id,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        set((state) => {
          const newDrafts = { ...state.drafts, [id]: newItem };
          return {
            drafts: newDrafts,
            glyphs: computeMergedGlyphs(newDrafts, state.remoteGlyphs)
          };
        });

        return newItem;
      },

      updateGlyph: (id, partial) => {
        set((state) => {
          let existing = state.drafts[id];
          if (!existing) {
            existing = state.remoteGlyphs.find(g => g.id === id) as AdminGlyphItem;
          }
          if (!existing) return state;

          const updated = { ...existing, ...partial, updatedAt: Date.now() };
          const newDrafts = { ...state.drafts, [id]: updated };
          return {
            drafts: newDrafts,
            glyphs: computeMergedGlyphs(newDrafts, state.remoteGlyphs)
          };
        });
      },

      deleteGlyph: (id) => {
        set((state) => {
          const newDrafts = { ...state.drafts };
          delete newDrafts[id];
          const newRemote = state.remoteGlyphs.filter((g) => g.id !== id);
          return {
            drafts: newDrafts,
            remoteGlyphs: newRemote,
            glyphs: computeMergedGlyphs(newDrafts, newRemote),
          };
        });
      },

      clearDraft: (id) => {
        set((state) => {
          const newDrafts = { ...state.drafts };
          delete newDrafts[id];
          return {
            drafts: newDrafts,
            glyphs: computeMergedGlyphs(newDrafts, state.remoteGlyphs)
          };
        });
      },

      getGlyphById: (id) => {
        return get().glyphs.find((g) => g.id === id);
      },

      resetToDefaults: () => {
        set({
          drafts: {},
          remoteGlyphs: [],
          glyphs: []
        });
      },
    }),
    {
      name: 'glyph-admin-glyphs-store',
      partialize: (state) => {
        const legacySeedIds = new Set(['glyph-seed-fire-dash', 'glyph-tidal-barrier', 'glyph-stone-spear']);
        const drafts: Record<string, AdminGlyphItem> = {};
        for (const [id, item] of Object.entries(state.drafts || {})) {
          if (!legacySeedIds.has(id)) {
            drafts[id] = item;
          }
        }
        return { drafts };
      },
    }
  )
);

// ===== Supabase Realtime Subscription =====

let glyphsRealtimeChannel: ReturnType<typeof supabase.channel> | null = null;

/**
 * Subscribes to Supabase realtime changes on the `glyphs` table.
 * On INSERT/UPDATE/DELETE, refetches the full glyph catalog and updates the store.
 * Call once on app mount. Returns an unsubscribe function.
 */
export function subscribeToRealtimeGlyphs(): () => void {
  if (glyphsRealtimeChannel) {
    supabase.removeChannel(glyphsRealtimeChannel);
  }

  glyphsRealtimeChannel = supabase
    .channel('glyphs-realtime')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'glyphs' },
      async (payload) => {
        console.log('[admin_glyphs_store] Realtime glyphs change:', payload.eventType);
        try {
          await useAdminGlyphsStore.getState().loadRemoteGlyphs();
        } catch (err) {
          console.error('[admin_glyphs_store] Failed to reload glyphs after realtime event:', err);
        }
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('[admin_glyphs_store] Realtime glyphs subscription active.');
      } else if (status === 'CHANNEL_ERROR') {
        console.error('[admin_glyphs_store] Realtime glyphs subscription error.');
      }
    });

  return () => {
    if (glyphsRealtimeChannel) {
      supabase.removeChannel(glyphsRealtimeChannel);
      glyphsRealtimeChannel = null;
    }
  };
}
