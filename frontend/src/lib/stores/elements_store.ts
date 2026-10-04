import { create } from 'zustand';
import { supabase } from '../supabase/supabase';
import { fetchElements } from '../apis/api';

export interface ElementItem {
  id: string;         // 'FIRE', 'WATER', etc.
  label: string;
  primaryColor: string;
  secondaryColor: string;
  particleVfxKey: string;
  baseHitDamage: number;
}

export interface ElementEffectItem {
  id: number;
  elementId: string;
  effectType: string;
  baseTickDamage: number;
  intervalTicks: number;
  durationTicks: number;
  baseMagnitude: number | null;
}

export interface ElementsState {
  elements: ElementItem[];
  effects: ElementEffectItem[];
  isLoading: boolean;
  loadElements: () => Promise<void>;
  getElementById: (id: string) => ElementItem | undefined;
  getEffectsForElement: (elementId: string) => ElementEffectItem[];
}

export const useElementsStore = create<ElementsState>()((set, get) => ({
  elements: [],
  effects: [],
  isLoading: false,

  loadElements: async () => {
    set({ isLoading: true });
    try {
      const { elements, effects } = await fetchElements();
      set({ elements, effects, isLoading: false });
    } catch (err) {
      console.error('[elements_store] Error loading elements:', err);
      set({ isLoading: false });
      throw err;
    }
  },

  getElementById: (id: string) => {
    return get().elements.find((e) => e.id === id);
  },

  getEffectsForElement: (elementId: string) => {
    return get().effects.filter((e) => e.elementId === elementId);
  },
}));

// ===== Supabase Realtime Subscription =====

let elementsRealtimeChannel: ReturnType<typeof supabase.channel> | null = null;

export function subscribeToRealtimeElements(): () => void {
  if (elementsRealtimeChannel) {
    supabase.removeChannel(elementsRealtimeChannel);
  }

  elementsRealtimeChannel = supabase
    .channel('elements-realtime')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'elements' },
      async (payload) => {
        console.log('[elements_store] Realtime elements change:', payload.eventType);
        try {
          await useElementsStore.getState().loadElements();
        } catch (err) {
          console.error('[elements_store] Failed to reload elements after realtime event:', err);
        }
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'element_effects' },
      async (payload) => {
        console.log('[elements_store] Realtime element_effects change:', payload.eventType);
        try {
          await useElementsStore.getState().loadElements();
        } catch (err) {
          console.error('[elements_store] Failed to reload element effects after realtime event:', err);
        }
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('[elements_store] Realtime elements subscription active.');
      } else if (status === 'CHANNEL_ERROR') {
        console.error('[elements_store] Realtime elements subscription error.');
      }
    });

  return () => {
    if (elementsRealtimeChannel) {
      supabase.removeChannel(elementsRealtimeChannel);
      elementsRealtimeChannel = null;
    }
  };
}
