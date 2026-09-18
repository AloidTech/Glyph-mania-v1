import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { NormalizationConfig, DEFAULT_NORMALIZATION } from '../sprites/spriteProcessor';

export interface SpriteStudioSettingsState {
  // Chroma Key Settings
  chromaHex: string;
  tolerance: number;
  smoothness: number;
  cleanUpEdges: number;

  // Normalization & Sizing Settings
  normConfig: NormalizationConfig;

  // View & Preview Settings
  previewBg: 'checker' | 'dark' | 'dungeon' | 'white';
  showGuides: boolean;
  zoomLevel: number;

  // Actions
  setChromaHex: (hex: string) => void;
  setTolerance: (tol: number) => void;
  setSmoothness: (sm: number) => void;
  setCleanUpEdges: (clean: number) => void;
  setNormConfig: (
    configOrUpdater:
      | Partial<NormalizationConfig>
      | ((prev: NormalizationConfig) => Partial<NormalizationConfig>)
  ) => void;
  setPreviewBg: (bg: 'checker' | 'dark' | 'dungeon' | 'white') => void;
  setShowGuides: (show: boolean) => void;
  setZoomLevel: (zoom: number) => void;

  // Presets & Persistence Actions
  resetToDefaults: () => void;
  exportSettingsJson: () => string;
  importSettingsJson: (jsonString: string) => boolean;
}

export const useSpriteStudioSettingsStore = create<SpriteStudioSettingsState>()(
  persist(
    (set, get) => ({
      // Defaults matching canonical Alex sprite requirements
      chromaHex: '#FF00FF',
      tolerance: 55,
      smoothness: 4,
      cleanUpEdges: 2,
      normConfig: { ...DEFAULT_NORMALIZATION },
      previewBg: 'checker',
      showGuides: true,
      zoomLevel: 1,

      setChromaHex: (hex) => set({ chromaHex: hex }),
      setTolerance: (tol) => set({ tolerance: tol }),
      setSmoothness: (sm) => set({ smoothness: sm }),
      setCleanUpEdges: (clean) => set({ cleanUpEdges: clean }),
      setNormConfig: (configOrUpdater) =>
        set((state) => {
          const partial =
            typeof configOrUpdater === 'function'
              ? configOrUpdater(state.normConfig)
              : configOrUpdater;
          return { normConfig: { ...state.normConfig, ...partial } };
        }),
      setPreviewBg: (bg) => set({ previewBg: bg }),
      setShowGuides: (show) => set({ showGuides: show }),
      setZoomLevel: (zoom) => set({ zoomLevel: zoom }),

      resetToDefaults: () =>
        set({
          chromaHex: '#FF00FF',
          tolerance: 55,
          smoothness: 4,
          cleanUpEdges: 2,
          normConfig: { ...DEFAULT_NORMALIZATION },
          previewBg: 'checker',
          showGuides: true,
          zoomLevel: 1,
        }),

      exportSettingsJson: () => {
        const {
          chromaHex,
          tolerance,
          smoothness,
          cleanUpEdges,
          normConfig,
          previewBg,
          showGuides,
          zoomLevel,
        } = get();

        return JSON.stringify(
          {
            chromaHex,
            tolerance,
            smoothness,
            cleanUpEdges,
            normConfig,
            previewBg,
            showGuides,
            zoomLevel,
            savedAt: new Date().toISOString(),
          },
          null,
          2
        );
      },

      importSettingsJson: (jsonString: string) => {
        try {
          const parsed = JSON.parse(jsonString);
          set((state) => ({
            ...state,
            ...(parsed.chromaHex ? { chromaHex: parsed.chromaHex } : {}),
            ...(typeof parsed.tolerance === 'number' ? { tolerance: parsed.tolerance } : {}),
            ...(typeof parsed.smoothness === 'number' ? { smoothness: parsed.smoothness } : {}),
            ...(typeof parsed.cleanUpEdges === 'number' ? { cleanUpEdges: parsed.cleanUpEdges } : {}),
            ...(parsed.normConfig ? { normConfig: { ...state.normConfig, ...parsed.normConfig } } : {}),
            ...(parsed.previewBg ? { previewBg: parsed.previewBg } : {}),
            ...(typeof parsed.showGuides === 'boolean' ? { showGuides: parsed.showGuides } : {}),
            ...(typeof parsed.zoomLevel === 'number' ? { zoomLevel: parsed.zoomLevel } : {}),
          }));
          return true;
        } catch (e) {
          console.error('Failed to parse settings JSON:', e);
          return false;
        }
      },
    }),
    {
      name: 'glyph_sprite_studio_settings',
    }
  )
);
