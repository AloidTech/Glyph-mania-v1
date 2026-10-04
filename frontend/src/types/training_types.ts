/**
 * Type definitions for ML Sigil Training Exemplars and Model Tracking.
 */

export interface TrainingExample {
  id: string;
  sigilId: string;
  vec: number[]; // 512-dim normalized feature vector
  thumb: string; // PNG/WebP Data URL or cloud storage URL
  createdAt: number;
  modelIds?: string[]; // Array of model IDs this exemplar was trained with
  firstModelTrainedId?: string;
  lastModelTrainedId?: string;
  synced?: boolean;
}

export interface TrainingExampleInput {
  vec: number[] | Float32Array;
  thumb: string;
  modelIds?: string[];
}

export interface TrainingExamplesBySigil {
  [sigilId: string]: TrainingExample[];
}
