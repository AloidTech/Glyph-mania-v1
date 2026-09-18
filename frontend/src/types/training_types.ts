/**
 * Type definitions for ML Sigil Training Exemplars and Model Tracking.
 */

export interface TrainingExample {
  id: string;
  sigilId: string;
  vec: number[]; // 512-dim normalized feature vector
  thumb: string; // PNG/WebP Data URL or cloud storage URL
  createdAt: number;
  firstModelTrainedId?: string | null; // ID of the model where this exemplar was first trained
  lastModelTrainedId?: string | null;  // ID of the model where this exemplar was most recently trained
  synced?: boolean;
}

export interface TrainingExampleInput {
  vec: number[] | Float32Array;
  thumb: string;
  firstModelTrainedId?: string | null;
  lastModelTrainedId?: string | null;
}

export interface TrainingExamplesBySigil {
  [sigilId: string]: TrainingExample[];
}
