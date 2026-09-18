declare module 'atrament' {
  export interface AtramentOptions {
    width?: number;
    height?: number;
    color?: string;
    weight?: number;
    smoothing?: number;
    adaptiveStroke?: boolean;
    mode?: string;
    secondaryMouseButton?: boolean;
    ignoreModifiers?: boolean;
    pressureLow?: number;
    pressureHigh?: number;
    pressureSmoothing?: number;
    fillWorker?: any;
  }

  export interface StrokePoint {
    point: { x: number; y: number };
    time: number;
    pressure: number;
  }

  export interface StrokeData {
    segments: StrokePoint[];
    mode: string;
    weight: number;
    smoothing: number;
    color: string;
    adaptiveStroke: boolean;
  }

  export class Atrament {
    constructor(
      selector: string | HTMLCanvasElement | Element | null,
      options?: AtramentOptions
    );

    canvas: HTMLCanvasElement;
    color: string;
    weight: number;
    smoothing: number;
    adaptiveStroke: boolean;
    mode: string;
    recordStrokes: boolean;
    secondaryMouseButton: boolean;
    ignoreModifiers: boolean;
    pressureLow: number;
    pressureHigh: number;
    pressureSmoothing: number;
    readonly dirty: boolean;
    readonly currentStroke: StrokeData;

    beginStroke(x: number, y: number): void;
    endStroke(x: number, y: number): void;
    draw(x1: number, y1: number, x2?: number, y2?: number, pressure?: number): { x: number; y: number };
    clear(): void;
    destroy(): void;
    getSmoothingFactor(t: number): number;

    addEventListener(event: string, listener: (event: any) => void): void;
    removeEventListener(event: string, listener: (event: any) => void): void;
    dispatchEvent(event: string, detail?: any): void;
  }

  export const MODE_DISABLED: string;
  export const MODE_DRAW: string;
  export const MODE_ERASE: string;
  export const MODE_FILL: string;

  export default Atrament;
}
