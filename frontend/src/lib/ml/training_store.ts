import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import { TrainingExample } from '../../types/training_types';
import { supabase } from '../supabase/supabase';
export type { TrainingExample };

// Zero-dependency asynchronous IndexedDB storage engine for Zustand
const indexedDbStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    return new Promise((resolve) => {
      try {
        const openReq = indexedDB.open('glyph_mania_ml_db', 1);
        openReq.onupgradeneeded = () => {
          if (!openReq.result.objectStoreNames.contains('keyval')) {
            openReq.result.createObjectStore('keyval');
          }
        };
        openReq.onsuccess = () => {
          const db = openReq.result;
          const tx = db.transaction('keyval', 'readonly');
          const store = tx.objectStore('keyval');
          const getReq = store.get(name);
          getReq.onsuccess = () => {
            if (getReq.result !== undefined && getReq.result !== null) {
              resolve(getReq.result);
            } else {
              // Seamless migration: fallback to localStorage if available, then migrate
              try {
                const localVal = localStorage.getItem(name);
                if (localVal) {
                  // Migrate into IndexedDB
                  indexedDbStorage.setItem(name, localVal);
                  localStorage.removeItem(name);
                }
                resolve(localVal);
              } catch {
                resolve(null);
              }
            }
          };
          getReq.onerror = () => resolve(null);
        };
        openReq.onerror = () => {
          // Fallback if IndexedDB fails to open
          try {
            resolve(localStorage.getItem(name));
          } catch {
            resolve(null);
          }
        };
      } catch {
        resolve(null);
      }
    });
  },

  setItem: async (name: string, value: string): Promise<void> => {
    // Keep localStorage synchronized as secondary fallback so stale data is never re-hydrated
    try {
      localStorage.setItem(name, value);
    } catch {}

    return new Promise((resolve, reject) => {
      try {
        const openReq = indexedDB.open('glyph_mania_ml_db', 1);
        openReq.onupgradeneeded = () => {
          if (!openReq.result.objectStoreNames.contains('keyval')) {
            openReq.result.createObjectStore('keyval');
          }
        };
        openReq.onsuccess = () => {
          const db = openReq.result;
          const tx = db.transaction('keyval', 'readwrite');
          const store = tx.objectStore('keyval');
          const putReq = store.put(value, name);
          putReq.onsuccess = () => resolve();
          putReq.onerror = () => reject(putReq.error);
        };
        openReq.onerror = () => reject(openReq.error);
      } catch (err) {
        reject(err);
      }
    });
  },

  removeItem: async (name: string): Promise<void> => {
    try {
      localStorage.removeItem(name);
    } catch {}

    return new Promise((resolve) => {
      try {
        const openReq = indexedDB.open('glyph_mania_ml_db', 1);
        openReq.onupgradeneeded = () => {
          if (!openReq.result.objectStoreNames.contains('keyval')) {
            openReq.result.createObjectStore('keyval');
          }
        };
        openReq.onsuccess = () => {
          const db = openReq.result;
          const tx = db.transaction('keyval', 'readwrite');
          const store = tx.objectStore('keyval');
          const delReq = store.delete(name);
          delReq.onsuccess = () => resolve();
          delReq.onerror = () => resolve();
        };
        openReq.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  },
};

export interface SerializedWeight {
  name: string;
  shape: number[];
  values: number[];
}

export interface TrainingProgress {
  epoch: number;
  totalEpochs: number;
  loss: number;
  accuracy: number;
}

export interface TrainingStoreState {
  examples: Record<string, TrainingExample[]>; // Keyed by sigil id (e.g., 'eff-fire')
  isTraining: boolean;
  trainingProgress: TrainingProgress | null;
  trainingHistory: { epoch: number; loss: number; accuracy: number }[];
  trainingError: string | null;
  savedWeights: SerializedWeight[] | null;
  trainedClassLabels: string[];
  lastTrainedAt: number | null;
  isModelUnsaved: boolean;

  addExample: (sigilId: string, example: { vec: number[] | Float32Array; thumb: string }) => Promise<void>;
  removeExample: (sigilId: string, exampleId: string) => void;
  clearExamplesForSigil: (sigilId: string) => void;
  clearAll: () => void;
  migrateAllExamplesToStorage: () => Promise<void>;
  getExamples: (sigilId: string) => TrainingExample[];
  getExamplesCount: (sigilId: string) => number;
  getTotalExamplesCount: () => number;
  getUntrainedExamplesCount: () => number;
  importExamples: (imported: Record<string, { vec: number[]; thumb: string }[]>) => void;
  tagExamplesWithModel: (modelId: string, sigilIds?: string[]) => void;
  
  // Training actions
  setIsTraining: (isTraining: boolean) => void;
  setTrainingProgress: (progress: TrainingProgress | null) => void;
  setTrainingHistory: (history: { epoch: number; loss: number; accuracy: number }[]) => void;
  setTrainingError: (error: string | null) => void;
  setSavedWeights: (weights: SerializedWeight[], classLabels: string[], isUnsaved?: boolean) => void;
  setIsModelUnsaved: (isUnsaved: boolean) => void;
}

export const useTrainingStore = create<TrainingStoreState>()(
  persist(
    (set, get) => ({
      examples: {},
      isTraining: false,
      trainingProgress: null,
      trainingHistory: [],
      trainingError: null,
      savedWeights: null,
      trainedClassLabels: [],
      lastTrainedAt: null,
      isModelUnsaved: false,

      setIsTraining: (isTraining) => set({ isTraining }),
      setTrainingProgress: (trainingProgress) => set({ trainingProgress }),
      setTrainingHistory: (trainingHistory) => set({ trainingHistory }),
      setTrainingError: (trainingError) => set({ trainingError }),
      setIsModelUnsaved: (isModelUnsaved) => set({ isModelUnsaved }),
      setSavedWeights: (savedWeights, trainedClassLabels, isUnsaved = false) =>
        set({ savedWeights, trainedClassLabels, isModelUnsaved: isUnsaved, lastTrainedAt: Date.now() }),

      addExample: async (sigilId, { vec, thumb }) => {
        const id = `ex-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const vecArray = Array.from(vec);
        
        let finalThumb = thumb;
        if (thumb.startsWith('data:image')) {
          try {
            // Upload to Supabase Storage
            const res = await fetch(thumb);
            const blob = await res.blob();
            const filePath = `training/${sigilId}/${id}.png`;
            
            const { error: uploadError } = await supabase.storage
              .from('assets')
              .upload(filePath, blob, { contentType: 'image/png', upsert: true });
              
            if (!uploadError) {
              const { data: publicUrlData } = supabase.storage.from('assets').getPublicUrl(filePath);
              finalThumb = publicUrlData.publicUrl;
            }
          } catch (e) {
            console.error('Failed to upload training example thumb', e);
          }
        }

        const newExample: TrainingExample = {
          id,
          sigilId,
          vec: vecArray,
          thumb: finalThumb,
          createdAt: Date.now(),
          firstModelTrainedId: null,
          lastModelTrainedId: null,
        };

        set((state) => ({
          examples: {
            ...state.examples,
            [sigilId]: [...(state.examples[sigilId] || []), newExample],
          },
        }));
      },

      tagExamplesWithModel: (modelId, sigilIds) => {
        set((state) => {
          const updated: Record<string, TrainingExample[]> = {};
          const targetSigils = sigilIds && sigilIds.length > 0 ? new Set(sigilIds) : null;

          for (const [sId, list] of Object.entries(state.examples)) {
            if (targetSigils && !targetSigils.has(sId)) {
              updated[sId] = list;
              continue;
            }
            updated[sId] = list.map((ex) => ({
              ...ex,
              firstModelTrainedId: ex.firstModelTrainedId || modelId,
              lastModelTrainedId: modelId,
            }));
          }

          return { examples: updated };
        });
      },

      removeExample: (sigilId, exampleId) => {
        set((state) => {
          const list = state.examples[sigilId] || [];
          const updated = list.filter((ex) => ex.id !== exampleId);
          return {
            examples: {
              ...state.examples,
              [sigilId]: updated,
            },
          };
        });
      },

      clearExamplesForSigil: (sigilId) => {
        set((state) => ({
          examples: {
            ...state.examples,
            [sigilId]: [],
          },
        }));
      },

      clearAll: () => {
        set({ examples: {} });
      },

      migrateAllExamplesToStorage: async () => {
        const state = get();
        const updatedExamples = { ...state.examples };
        let migratedCount = 0;

        for (const [sigilId, list] of Object.entries(updatedExamples)) {
          const newList = [...list];
          for (let i = 0; i < newList.length; i++) {
            const ex = newList[i];
            if (ex.thumb && ex.thumb.startsWith('data:image')) {
              try {
                const res = await fetch(ex.thumb);
                const blob = await res.blob();
                const filePath = `training/${sigilId}/${ex.id}.png`;
                
                const { error: uploadError } = await supabase.storage
                  .from('assets')
                  .upload(filePath, blob, { contentType: 'image/png', upsert: true });
                  
                if (!uploadError) {
                  const { data: publicUrlData } = supabase.storage.from('assets').getPublicUrl(filePath);
                  newList[i] = { ...ex, thumb: publicUrlData.publicUrl };
                  migratedCount++;
                }
              } catch (e) {
                console.error(`Failed to migrate example ${ex.id}`, e);
              }
            }
          }
          updatedExamples[sigilId] = newList;
        }

        set({ examples: updatedExamples });
        console.log(`Migration complete. Successfully moved ${migratedCount} exemplars to Supabase Storage.`);
      },

      getExamples: (sigilId) => {
        return get().examples[sigilId] || [];
      },

      getExamplesCount: (sigilId) => {
        return (get().examples[sigilId] || []).length;
      },

      getTotalExamplesCount: () => {
        const all = get().examples;
        return Object.values(all).reduce((sum, list) => sum + list.length, 0);
      },

      getUntrainedExamplesCount: () => {
        const state = get();
        const lastTrained = state.lastTrainedAt;
        const all = Object.values(state.examples).flat();
        
        if (!lastTrained) return all.length;
        return all.filter(ex => ex.createdAt > lastTrained).length;
      },

      importExamples: (imported) => {
        set((state) => {
          const merged = { ...state.examples };
          for (const sigilId of Object.keys(imported)) {
            const list = imported[sigilId] || [];
            const mapped: TrainingExample[] = list.map((item, idx) => ({
              id: `imp-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
              sigilId,
              vec: Array.from(item.vec),
              thumb: item.thumb,
              createdAt: Date.now(),
              firstModelTrainedId: (item as any).firstModelTrainedId || null,
              lastModelTrainedId: (item as any).lastModelTrainedId || null,
            }));
            
            if (!merged[sigilId]) merged[sigilId] = [];
            merged[sigilId] = [...merged[sigilId], ...mapped];
          }
          return { examples: merged };
        });
      },
    }),
    {
      name: 'glyph-sigil-training-store',
      storage: createJSONStorage(() => indexedDbStorage),
      partialize: (state) => ({
        examples: state.examples,
        savedWeights: state.savedWeights,
        trainedClassLabels: state.trainedClassLabels,
        lastTrainedAt: state.lastTrainedAt,
        isModelUnsaved: state.isModelUnsaved,
        trainingProgress: state.trainingProgress,
        trainingHistory: state.trainingHistory,
      }),
    }
  )
);

// Expose the migration script to the browser console for easy execution
if (typeof window !== 'undefined') {
  (window as any).migrateMLStorage = () => {
    console.log("Starting ML Exemplar Migration to Supabase Storage...");
    useTrainingStore.getState().migrateAllExamplesToStorage();
  };
}
