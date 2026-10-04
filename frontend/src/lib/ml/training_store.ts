import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import { TrainingExample } from '../../types/training_types';
import { supabase } from '../supabase/supabase';
import { fetchRemoteTrainingExamples } from '../apis/api';
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
  isLoadingRemote: boolean;

  loadRemoteExamples: () => Promise<TrainingExample[]>;
  addExample: (sigilId: string, example: { vec: number[] | Float32Array; thumb: string }) => Promise<void>;
  removeExample: (sigilId: string, exampleId: string) => Promise<void> | void;
  clearExamplesForSigil: (sigilId: string) => Promise<void> | void;
  clearAll: () => void;
  migrateAllExamplesToStorage: () => Promise<void>;
  syncAllExamplesToSupabase: () => Promise<{ total: number; synced: number }>;
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
      isLoadingRemote: false,

      loadRemoteExamples: async () => {
        set({ isLoadingRemote: true });
        try {
          const remoteList = await fetchRemoteTrainingExamples();
          const grouped: Record<string, TrainingExample[]> = {};
          for (const ex of remoteList) {
            if (!grouped[ex.sigilId]) grouped[ex.sigilId] = [];
            grouped[ex.sigilId].push(ex);
          }

          // Merge with any unsynced local drafts so offline work is never lost
          const currentLocal = get().examples;
          const merged: Record<string, TrainingExample[]> = { ...grouped };
          for (const [sigilId, localList] of Object.entries(currentLocal)) {
            const unsynced = localList.filter((l) => !l.synced && !merged[sigilId]?.some((r) => r.id === l.id));
            if (unsynced.length > 0) {
              merged[sigilId] = [...(merged[sigilId] || []), ...unsynced];
            }
          }

          set({ examples: merged, isLoadingRemote: false });
          return remoteList;
        } catch (err) {
          console.error('[training_store] Failed to load remote examples from Supabase:', err);
          set({ isLoadingRemote: false });
          throw err;
        }
      },

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
          modelIds: [],
          synced: true,
        };

        set((state) => ({
          examples: {
            ...state.examples,
            [sigilId]: [...(state.examples[sigilId] || []), newExample],
          },
        }));

        // Immediately upload example to Supabase database table
        try {
          await supabase.from('training_examples').insert({
            id,
            sigil_id: sigilId,
            vec: vecArray,
            thumb: finalThumb,
            model_ids: [],
            created_at: new Date(newExample.createdAt).toISOString(),
            updated_at: new Date().toISOString(),
          });
        } catch (dbErr) {
          console.error('Failed to insert example into Supabase DB:', dbErr);
        }
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
            updated[sId] = list.map((ex) => {
              // Backward-compatible hydration of modelIds from old scalar fields if present
              const existingIds: string[] = Array.isArray(ex.modelIds)
                ? [...ex.modelIds]
                : ([(ex as any).firstModelTrainedId, (ex as any).lastModelTrainedId].filter(Boolean) as string[]);

              if (!existingIds.includes(modelId)) {
                existingIds.push(modelId);
              }

              return {
                ...ex,
                modelIds: existingIds,
              };
            });
          }

          return { examples: updated };
        });
      },

      removeExample: async (sigilId, exampleId) => {
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

        // Delete from Supabase DB and storage
        try {
          await supabase.from('training_examples').delete().eq('id', exampleId);
          const filePath = `training/${sigilId}/${exampleId}.png`;
          await supabase.storage.from('assets').remove([filePath]);
        } catch (delErr) {
          console.error('Failed to delete training example from Supabase:', delErr);
        }
      },

      clearExamplesForSigil: async (sigilId) => {
        set((state) => ({
          examples: {
            ...state.examples,
            [sigilId]: [],
          },
        }));

        try {
          await supabase.from('training_examples').delete().eq('sigil_id', sigilId);
        } catch (delErr) {
          console.error('Failed to clear training examples from Supabase:', delErr);
        }
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

      syncAllExamplesToSupabase: async () => {
        const state = get();
        const updatedExamples = { ...state.examples };
        let syncedCount = 0;
        const batch: any[] = [];

        // Legacy UUID to semantic ID map to guarantee clean foreign key relational integrity
        const uuidToSemanticId: Record<string, string> = {
          '9831dbb9-718c-4961-b3f0-458d25295364': 'eff-earth',
          'dc4cec64-ab17-49a3-930e-7276310244a3': 'aug-form-whirl',
          'b15c9c2c-4ed9-483a-8fbd-3f79a48ef1a6': 'aug-position',
          'e0115e15-63d2-49f6-98b4-5d50c69b0f49': 'aug-form-compress',
          '6eed2dce-5968-4448-a8b6-72566a990f6b': 'eff-air',
          '78b26b48-3879-4e3a-b30c-71eb78dd8860': 'eff-water',
          '7533058c-3092-4bfe-857b-5bfc3a3fbd16': 'aug-form-dash',
          'aug-condense': 'aug-form-condense',
        };

        const remappedStore: Record<string, TrainingExample[]> = {};

        for (const [rawSigilId, list] of Object.entries(updatedExamples)) {
          const cleanSigilId = rawSigilId.trim();
          const targetSigilId = uuidToSemanticId[cleanSigilId] || cleanSigilId;

          const updatedList: TrainingExample[] = [];

          for (const ex of list) {
            let finalThumb = ex.thumb;
            // Upload base64 thumb to Supabase Storage if not already uploaded
            if (ex.thumb && ex.thumb.startsWith('data:image')) {
              try {
                const res = await fetch(ex.thumb);
                const blob = await res.blob();
                const filePath = `training/${targetSigilId}/${ex.id}.png`;
                const { error: uploadError } = await supabase.storage
                  .from('assets')
                  .upload(filePath, blob, { contentType: 'image/png', upsert: true });

                if (!uploadError) {
                  const { data: publicUrlData } = supabase.storage.from('assets').getPublicUrl(filePath);
                  finalThumb = publicUrlData.publicUrl;
                }
              } catch (e) {
                console.warn(`Could not upload thumb for example ${ex.id}:`, e);
              }
            }

            // Hydrate modelIds array from legacy fields if needed
            const modelIds: string[] = Array.isArray(ex.modelIds)
              ? ex.modelIds
              : ([(ex as any).firstModelTrainedId, (ex as any).lastModelTrainedId].filter(Boolean) as string[]);

            const converted: TrainingExample = {
              ...ex,
              sigilId: targetSigilId,
              thumb: finalThumb,
              modelIds,
              synced: true,
            };

            updatedList.push(converted);

            // Stage for Supabase database upsert
            batch.push({
              id: ex.id,
              sigil_id: targetSigilId,
              vec: Array.from(ex.vec),
              thumb: finalThumb,
              model_ids: modelIds,
              created_at: new Date(ex.createdAt).toISOString(),
              updated_at: new Date().toISOString(),
            });
          }

          if (!remappedStore[targetSigilId]) {
            remappedStore[targetSigilId] = [];
          }
          remappedStore[targetSigilId].push(...updatedList);
        }

        // Batch upsert to Supabase in chunks of 50
        const chunkSize = 50;
        for (let i = 0; i < batch.length; i += chunkSize) {
          const chunk = batch.slice(i, i + chunkSize);
          const { error: upsertErr } = await supabase
            .from('training_examples')
            .upsert(chunk, { onConflict: 'id' });

          if (upsertErr) {
            console.error('Failed to upsert chunk to training_examples in Supabase:', upsertErr);
          } else {
            syncedCount += chunk.length;
          }
        }

        set({ examples: remappedStore });
        console.log(`Sync complete! ${syncedCount} of ${batch.length} examples saved to Supabase.`);
        return { total: batch.length, synced: syncedCount };
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
              modelIds: (item as any).modelIds || ([(item as any).firstModelTrainedId, (item as any).lastModelTrainedId].filter(Boolean) as string[]),
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

// Expose the migration and cloud sync scripts to the browser console for easy execution
if (typeof window !== 'undefined') {
  (window as any).migrateMLStorage = () => {
    console.log("Starting ML Exemplar Migration to Supabase Storage...");
    useTrainingStore.getState().migrateAllExamplesToStorage();
  };
  (window as any).syncMLToSupabase = async () => {
    console.log("Starting ML Exemplar Sync to Supabase...");
    return await useTrainingStore.getState().syncAllExamplesToSupabase();
  };
}

// ===== Supabase Realtime Subscription for Training Examples =====
let trainingExamplesChannel: ReturnType<typeof supabase.channel> | null = null;

export function subscribeToRealtimeTrainingExamples(): () => void {
  if (trainingExamplesChannel) {
    supabase.removeChannel(trainingExamplesChannel);
  }

  trainingExamplesChannel = supabase
    .channel('training-examples-realtime')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'training_examples' },
      async (payload) => {
        console.log('[training_store] Realtime training_examples change:', payload.eventType);
        try {
          await useTrainingStore.getState().loadRemoteExamples();
        } catch (err) {
          console.error('[training_store] Failed to reload examples after realtime event:', err);
        }
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('[training_store] Realtime training_examples subscription active.');
      } else if (status === 'CHANNEL_ERROR') {
        console.error('[training_store] Realtime training_examples subscription error.');
      }
    });

  return () => {
    if (trainingExamplesChannel) {
      supabase.removeChannel(trainingExamplesChannel);
      trainingExamplesChannel = null;
    }
  };
}

