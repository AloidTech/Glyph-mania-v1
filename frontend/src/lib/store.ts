import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
          settings: { ...state.settings, ...partial }
        }));
      },
    }),
    {
      name: 'game-store-storage',
      partialize: (state) => ({
        settings: state.settings
      })
    }
  )
);

