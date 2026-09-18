import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import { SavedModel } from '../../types/model_types';
import { useTrainingStore } from './training_store';

// Zero-dependency asynchronous IndexedDB storage engine for saved models
const modelsIndexedDbStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    return new Promise((resolve) => {
      try {
        const openReq = indexedDB.open('glyph_mania_models_db', 1);
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
              try {
                const localVal = localStorage.getItem(name);
                if (localVal) {
                  modelsIndexedDbStorage.setItem(name, localVal);
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
    try {
      localStorage.setItem(name, value);
    } catch {}

    return new Promise((resolve, reject) => {
      try {
        const openReq = indexedDB.open('glyph_mania_models_db', 1);
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
        const openReq = indexedDB.open('glyph_mania_models_db', 1);
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

export interface SavedModelsState {
  models: SavedModel[];
  activeModelId: string | null;

  saveModel: (data: Omit<SavedModel, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => SavedModel;
  renameModel: (id: string, newName: string) => void;
  deleteModel: (id: string) => void;
  loadModel: (id: string) => void;
  getModelById: (id: string) => SavedModel | undefined;
}

export const useSavedModelsStore = create<SavedModelsState>()(
  persist(
    (set, get) => ({
      models: [],
      activeModelId: null,

      saveModel: (data) => {
        const id = data.id || `model-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const now = Date.now();
        const historyToSave = data.history && data.history.length > 0
          ? data.history
          : useTrainingStore.getState().trainingHistory;

        const newModel: SavedModel = {
          ...data,
          id,
          createdAt: now,
          updatedAt: now,
          history: historyToSave,
          isLoaded: true,
        };

        set((state) => {
          // Mark all existing models as not loaded if new model is loaded
          const updatedModels = state.models.map((m) => ({ ...m, isLoaded: false }));
          return {
            models: [newModel, ...updatedModels],
            activeModelId: id,
          };
        });

        // Sync weights and history to active training store and mark model as saved
        useTrainingStore.getState().setSavedWeights(newModel.weights, newModel.classLabels, false);
        if (historyToSave && historyToSave.length > 0) {
          useTrainingStore.getState().setTrainingHistory(historyToSave);
        }

        return newModel;
      },

      renameModel: (id, newName) => {
        const trimmed = newName.trim();
        if (!trimmed) return;

        set((state) => ({
          models: state.models.map((m) =>
            m.id === id ? { ...m, name: trimmed, updatedAt: Date.now() } : m
          ),
        }));
      },

      deleteModel: (id) => {
        set((state) => {
          const filtered = state.models.filter((m) => m.id !== id);
          const wasActive = state.activeModelId === id;
          const nextActiveId = wasActive ? (filtered[0]?.id || null) : state.activeModelId;

          if (wasActive && filtered[0]) {
            filtered[0] = { ...filtered[0], isLoaded: true };
            useTrainingStore.getState().setSavedWeights(filtered[0].weights, filtered[0].classLabels, false);
            if (filtered[0].history) {
              useTrainingStore.getState().setTrainingHistory(filtered[0].history);
            }
          }

          return {
            models: filtered,
            activeModelId: nextActiveId,
          };
        });
      },

      loadModel: (id) => {
        const target = get().models.find((m) => m.id === id);
        if (!target) return;

        set((state) => ({
          models: state.models.map((m) => ({
            ...m,
            isLoaded: m.id === id,
          })),
          activeModelId: id,
        }));

        // Load network weights into the active inference engine and mark as saved
        useTrainingStore.getState().setSavedWeights(target.weights, target.classLabels, false);
        useTrainingStore.getState().setTrainingProgress({
          epoch: target.epochs,
          totalEpochs: target.epochs,
          loss: target.finalLoss,
          accuracy: target.finalAccuracy,
        });
        useTrainingStore.getState().setTrainingHistory(target.history || []);
      },

      getModelById: (id) => {
        return get().models.find((m) => m.id === id);
      },
    }),
    {
      name: 'glyph-saved-models-store',
      storage: createJSONStorage(() => modelsIndexedDbStorage),
    }
  )
);
