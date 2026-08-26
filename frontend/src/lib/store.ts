import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Stroke } from './types/glyph_types';

export type ScreenState = 'MAIN_MENU' | 'SETTINGS' | 'IN_GAME' | 'PAUSED';

export interface SettingsState {
  masterVolume: number;
  sfxVolume: number;
  sfxEnabled: boolean;
}

export interface GameState {
  activeScreen: ScreenState;
  settings: SettingsState;

  // Navigation & Actions
  setScreen: (screen: ScreenState) => void;
  startNewGame: () => void;
  resetGameSession: () => void;
  updateSettings: (partial: Partial<SettingsState>) => void;
}

export interface WorkShopState {
  selectedTool: string;
  strokes: Stroke[];
  redoStack: Stroke[];
  
  setSelectedTool: (tool: string) => void;
  addStroke: (stroke: Stroke) => void;
  undo: () => void;
  redo: () => void;
  clearStrokes: () => void;
}

export const useWorkShopStore = create<WorkShopState>()(
  persist(
    (set) => ({
      selectedTool: 'pen',
      strokes: [],
      redoStack: [],

      setSelectedTool: (tool: string) => set({ selectedTool: tool }),

      addStroke: (stroke: Stroke) =>
        set((state) => ({
          strokes: [...state.strokes, stroke],
          redoStack: [], // Clear redo stack on new action
        })),

      undo: () =>
        set((state) => {
          if (state.strokes.length === 0) return state;
          const lastStroke = state.strokes[state.strokes.length - 1];
          return {
            strokes: state.strokes.slice(0, -1),
            redoStack: [...state.redoStack, lastStroke],
          };
        }),

      redo: () =>
        set((state) => {
          if (state.redoStack.length === 0) return state;
          const strokeToRedo = state.redoStack[state.redoStack.length - 1];
          return {
            strokes: [...state.strokes, strokeToRedo],
            redoStack: state.redoStack.slice(0, -1),
          };
        }),

      clearStrokes: () => set({ strokes: [], redoStack: [] }),
    }),
    {
      name: 'workshop-store-storage',
      partialize: (state) => ({
        selectedTool: state.selectedTool,
      }),
    }
  )
);

export const useGameStore = create<GameState>()(
  persist(
    (set) => ({
      activeScreen: 'MAIN_MENU',

      settings: {
        masterVolume: 80,
        sfxVolume: 85,
        sfxEnabled: true,
      },

      setScreen: (screen) => set({ activeScreen: screen }),

      startNewGame: () => set({ activeScreen: 'IN_GAME' }),

      resetGameSession: () => set({ activeScreen: 'MAIN_MENU' }),

      updateSettings: (partial) => {
        set((state) => ({
          settings: { ...state.settings, ...partial },
        }));
      },
    }),
    {
      name: 'game-store-storage',
      partialize: (state) => ({
        settings: state.settings,
      }),
    }
  )
);
