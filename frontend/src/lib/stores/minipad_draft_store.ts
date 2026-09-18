import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { StrokeData } from 'atrament';
import type { WorkshopGlyphItem } from '../../components/WorkshopCatalogMenu/GlyphCard';

const safeLocalStorage = {
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
      console.warn(`[minipad_draft_store] Quota exceeded or error saving "${name}" to localStorage:`, err);
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

export interface MiniPadDraftState {
  /** Raw live strokes drawn on the mini drawing pad */
  activeStrokes: StrokeData[];
  /** The current active glyph formed or cast on the mini pad */
  activeGlyph: WorkshopGlyphItem | null;
  /** Whether the parchment scroll is currently rolled up */
  isClosed: boolean;
  lastUpdated: number;

  setLiveStrokes: (strokes: StrokeData[]) => void;
  setActiveGlyph: (glyph: WorkshopGlyphItem | null) => void;
  setIsClosed: (isClosed: boolean) => void;
  clearLiveSession: () => void;
}

export const useMiniPadDraftStore = create<MiniPadDraftState>()(
  persist(
    (set) => ({
      activeStrokes: [],
      activeGlyph: null,
      isClosed: false,
      lastUpdated: 0,

      setLiveStrokes: (strokes) => {
        set({ activeStrokes: strokes, lastUpdated: Date.now() });
      },

      setActiveGlyph: (glyph) => {
        set({ activeGlyph: glyph, lastUpdated: Date.now() });
      },

      setIsClosed: (isClosed) => {
        set({ isClosed });
      },

      clearLiveSession: () => {
        set({ activeStrokes: [], activeGlyph: null, lastUpdated: Date.now() });
      },
    }),
    {
      name: 'minipad-live-drawing-session',
      storage: createJSONStorage(() => safeLocalStorage),
      partialize: (state) => ({
        activeStrokes: state.activeStrokes,
        activeGlyph: state.activeGlyph,
        isClosed: state.isClosed,
        lastUpdated: state.lastUpdated,
      }),
    }
  )
);
