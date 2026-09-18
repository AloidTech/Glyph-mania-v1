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
      console.warn(`[workshop_draft_store] Quota exceeded or error saving "${name}" to localStorage:`, err);
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

export interface WorkshopDraftState {
  /** Raw live strokes being drawn on the pad right now (not yet saved as a named glyph) */
  activeStrokes: StrokeData[];
  activeGlyphId: string | null;
  lastUpdated: number;

  /**
   * The current saved-but-not-yet-cloud-synced workshop draft.
   * Only ONE draft is allowed at a time — saving a new one replaces the previous.
   * Cleared when the glyph is successfully saved to the cloud or explicitly deleted.
   */
  workshopDraft: WorkshopGlyphItem | null;
  workshopDraftStrokes: StrokeData[];

  setLiveStrokes: (strokes: StrokeData[]) => void;
  setActiveGlyphId: (id: string | null) => void;
  clearLiveSession: () => void;

  /** Overwrite (or create) the single workshop draft slot */
  setWorkshopDraft: (glyph: WorkshopGlyphItem, strokes: StrokeData[]) => void;
  /** Remove the draft once it has been cloud-saved or deleted */
  clearWorkshopDraft: () => void;
}

export const useWorkshopDraftStore = create<WorkshopDraftState>()(
  persist(
    (set) => ({
      activeStrokes: [],
      activeGlyphId: null,
      lastUpdated: 0,
      workshopDraft: null,
      workshopDraftStrokes: [],

      setLiveStrokes: (strokes) => {
        set({ activeStrokes: strokes, lastUpdated: Date.now() });
      },

      setActiveGlyphId: (id) => {
        set({ activeGlyphId: id });
      },

      clearLiveSession: () => {
        set({ activeStrokes: [], activeGlyphId: null, lastUpdated: Date.now() });
      },

      setWorkshopDraft: (glyph, strokes) => {
        set({ workshopDraft: glyph, workshopDraftStrokes: strokes });
      },

      clearWorkshopDraft: () => {
        set({ workshopDraft: null, workshopDraftStrokes: [] });
      },
    }),
    {
      name: 'workshop-live-drawing-session',
      storage: createJSONStorage(() => safeLocalStorage),
      partialize: (state) => ({
        activeStrokes: state.activeStrokes,
        activeGlyphId: state.activeGlyphId,
        lastUpdated: state.lastUpdated,
        workshopDraft: state.workshopDraft,
        workshopDraftStrokes: state.workshopDraftStrokes,
      }),
    }
  )
);
