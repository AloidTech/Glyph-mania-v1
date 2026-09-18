import { SerializedWeight } from '../lib/ml/training_store';

export interface SavedModel {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
  epochs: number;
  batchSize?: number;
  finalLoss: number;
  finalAccuracy: number;
  totalExamplesCount: number;
  classLabels: string[];
  weights: SerializedWeight[];
  history?: { epoch: number; loss: number; accuracy: number }[];
  isLoaded?: boolean;
}

export type SortField = 'name' | 'createdAt' | 'finalAccuracy' | 'finalLoss';
export type SortDirection = 'asc' | 'desc';
