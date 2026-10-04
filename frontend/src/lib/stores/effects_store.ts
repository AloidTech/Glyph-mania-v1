import { create } from 'zustand';
import { supabase } from '../supabase/supabase';
import { fetchMasterEffects } from '../apis/api';
import type { EffectDefinition } from '../../types/phenomenon_types';

export interface EffectsState {
  effects: EffectDefinition[];
  isLoading: boolean;
  loadEffects: () => Promise<void>;
  getEffectById: (id: string) => EffectDefinition | undefined;
}

export const useEffectsStore = create<EffectsState>()((set, get) => ({
  effects: [],
  isLoading: false,

  loadEffects: async () => {
    set({ isLoading: true });
    try {
      const effects = await fetchMasterEffects();
      set({ effects, isLoading: false });
    } catch (err) {
      console.error('[effects_store] Failed to load effects:', err);
      set({ isLoading: false });
    }
  },

  getEffectById: (id: string) => {
    return get().effects.find((ef) => ef.id.toUpperCase() === id.toUpperCase());
  },
}));

// ===== Supabase Realtime Subscription =====
let effectsRealtimeChannel: ReturnType<typeof supabase.channel> | null = null;

export function subscribeToRealtimeEffects(): () => void {
  if (effectsRealtimeChannel) {
    supabase.removeChannel(effectsRealtimeChannel);
  }

  effectsRealtimeChannel = supabase
    .channel('master-effects-realtime')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'effects' },
      async () => {
        try {
          await useEffectsStore.getState().loadEffects();
        } catch (err) {
          console.error('[effects_store] Realtime reload error:', err);
        }
      }
    )
    .subscribe();

  return () => {
    if (effectsRealtimeChannel) {
      supabase.removeChannel(effectsRealtimeChannel);
      effectsRealtimeChannel = null;
    }
  };
}
