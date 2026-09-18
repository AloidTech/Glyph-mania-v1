import { create } from 'zustand';

export interface StagedFrame {
  name: string;
  canvas: HTMLCanvasElement;
  sourceImage?: HTMLImageElement;
}

export interface SpriteTransferState {
  stagedFrames: StagedFrame[];
  sourceOrigin: 'video_frame_picker' | 'sprite_sheet_importer' | null;
  stageFrames: (frames: StagedFrame[], origin?: 'video_frame_picker' | 'sprite_sheet_importer') => void;
  clearStagedFrames: () => void;
}

export const useSpriteTransferStore = create<SpriteTransferState>((set) => ({
  stagedFrames: [],
  sourceOrigin: null,
  stageFrames: (frames, origin = 'video_frame_picker') =>
    set({ stagedFrames: frames, sourceOrigin: origin }),
  clearStagedFrames: () => set({ stagedFrames: [], sourceOrigin: null }),
}));
