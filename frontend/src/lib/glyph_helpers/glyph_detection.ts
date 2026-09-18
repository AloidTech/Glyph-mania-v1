/**
 * @file glyph_detection.ts
 * @description Glyph Detection & Geometric Boundary System.
 *
 * Dedicated to geometric detection of drawn glyph boundaries, including:
 * - Detecting the outermost enclosing circle/ring around inner sigil components.
 * - Testing whether the enclosing ring is closed or open (gap & angular sweep analysis).
 * - Identifying spatial bounding regions and circle metrics.
 *
 * (Note: ML model training logic has been moved to `./ml/model_trainer.ts`.)
 */

import type { GlyphCompositionAnalysis, SegmentedCrop, Point, BoundingBox } from '../ml/glyph_semantic_engine';

export interface EnclosingCircleDetectionResult {
  /** Whether a candidate enclosing circle/ring was detected around the glyph */
  hasCircle: boolean;
  /** Whether the detected circle is fully closed (seamless loop with no significant opening) */
  isClosed: boolean;
  /** Whether the detected circle has an opening (gap in the perimeter) */
  isOpen: boolean;
  /** Angular coverage percentage around the center (0.0 to 1.0) */
  coverage: number;
  /** Largest contiguous opening gap angle in degrees (0 to 360) */
  maxGapAngle: number;
  /** Estimated radius of the circle in pixels */
  radius: number;
  /** Center point of the enclosing circle */
  center: Point;
  /** The SegmentedCrop representing the circle stroke component, if found */
  circleCrop: SegmentedCrop | null;
  /** Number of inner sigils enclosed inside this circle */
  innerSigilsCount: number;
}

const DEFAULT_NO_CIRCLE: EnclosingCircleDetectionResult = {
  hasCircle: false,
  isClosed: false,
  isOpen: false,
  coverage: 0,
  maxGapAngle: 360,
  radius: 0,
  center: { x: 0, y: 0 },
  circleCrop: null,
  innerSigilsCount: 0,
};

/**
 * Detects the largest circle/ring drawn around all the sigils in a glyph composition,
 * and determines whether the circle is completely closed or has an open gap.
 *
 * @param analysis The semantic analysis result containing raw segmented crops
 * @param sourceCanvas Optional canvas element for additional pixel verification
 * @returns EnclosingCircleDetectionResult with closure status and geometric metrics
 */
export function detectEnclosingCircle(
  analysis: GlyphCompositionAnalysis | null | undefined,
  sourceCanvas?: HTMLCanvasElement | null
): EnclosingCircleDetectionResult {
  if (!analysis || !analysis.rawCrops || analysis.rawCrops.length === 0) {
    return DEFAULT_NO_CIRCLE;
  }

  const crops = analysis.rawCrops;
  const canvasW = sourceCanvas?.width || 500;
  const canvasH = sourceCanvas?.height || 500;
  const canvasCenterX = canvasW / 2;
  const canvasCenterY = canvasH / 2;

  // 1. Identify Candidate Enclosing Circle Crop
  // The outer ring has:
  // - Large bounding box dimensions (spanning at least ~30% of canvas)
  // - Aspect ratio roughly circular (~0.6 to ~1.6)
  // - Center close to glyph center
  // - Encloses other smaller components
  let bestCandidate: SegmentedCrop | null = null;
  let maxScore = -1;

  for (const crop of crops) {
    const { width, height, x, y } = crop.bbox;
    const diag = Math.sqrt(width * width + height * height);
    const aspect = width / (height || 1);

    // Filter out obvious non-circles (must be reasonably circular and large)
    if (aspect < 0.55 || aspect > 1.8) continue;
    if (width < 140 && height < 140) continue;

    // Calculate how many OTHER crops lie inside this crop's bounding box
    let enclosedCount = 0;
    for (const other of crops) {
      if (other === crop) continue;
      const ox = other.center.x;
      const oy = other.center.y;
      // Allow a small margin of 15px outside
      if (
        ox >= x - 15 &&
        ox <= x + width + 15 &&
        oy >= y - 15 &&
        oy <= y + height + 15
      ) {
        enclosedCount++;
      }
    }

    // Distance of center from canvas center
    const distToCenter = Math.sqrt(
      Math.pow(crop.center.x - canvasCenterX, 2) +
      Math.pow(crop.center.y - canvasCenterY, 2)
    );

    // Candidate score balances size, enclosure, and centerness
    const sizeScore = diag;
    const enclosureScore = enclosedCount * 120;
    const centerPenalty = distToCenter * 0.8;
    const score = sizeScore + enclosureScore - centerPenalty;

    if (score > maxScore) {
      maxScore = score;
      bestCandidate = crop;
    }
  }

  if (!bestCandidate) {
    return DEFAULT_NO_CIRCLE;
  }

  // Count inner sigils inside this candidate
  const candidateBBox = bestCandidate.bbox;
  let innerSigilsCount = 0;
  for (const other of crops) {
    if (other === bestCandidate) continue;
    if (
      other.center.x >= candidateBBox.x &&
      other.center.x <= candidateBBox.x + candidateBBox.width &&
      other.center.y >= candidateBBox.y &&
      other.center.y <= candidateBBox.y + candidateBBox.height
    ) {
      innerSigilsCount++;
    }
  }

  // 2. Perform 360-Degree Angular Sweep on the Candidate Crop
  // Divide full circle into N sectors (each 5 degrees) to find gaps
  const NUM_SECTORS = 72; // 360 / 5 = 72 bins
  const sectorHits = new Uint8Array(NUM_SECTORS);

  const cropCanvas = bestCandidate.canvas;
  const ctx = cropCanvas.getContext('2d');
  if (!ctx) {
    return {
      ...DEFAULT_NO_CIRCLE,
      hasCircle: true,
      circleCrop: bestCandidate,
      center: bestCandidate.center,
      radius: (candidateBBox.width + candidateBBox.height) / 4,
      innerSigilsCount,
    };
  }

  const cropW = cropCanvas.width;
  const cropH = cropCanvas.height;
  const imgData = ctx.getImageData(0, 0, cropW, cropH);
  const data = imgData.data;

  const cropCenterX = cropW / 2;
  const cropCenterY = cropH / 2;
  const approxRadius = (candidateBBox.width + candidateBBox.height) / 4;
  const minRadiusThreshold = Math.max(25, approxRadius * 0.35);

  let totalStrokePixels = 0;

  for (let py = 0; py < cropH; py++) {
    for (let px = 0; px < cropW; px++) {
      const alpha = data[(py * cropW + px) * 4 + 3];
      if (alpha < 30) continue;

      totalStrokePixels++;
      const dx = px - cropCenterX;
      const dy = py - cropCenterY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Only count stroke pixels at a reasonable distance from the center (ignore inner noise)
      if (dist >= minRadiusThreshold) {
        const angle = Math.atan2(dy, dx); // [-PI, PI]
        let sector = Math.floor(((angle + Math.PI) / (2 * Math.PI)) * NUM_SECTORS);
        if (sector < 0) sector = 0;
        if (sector >= NUM_SECTORS) sector = NUM_SECTORS - 1;
        sectorHits[sector] = 1;
      }
    }
  }

  // If there are barely any pixels, no circle
  if (totalStrokePixels < 80) {
    return DEFAULT_NO_CIRCLE;
  }

  // 3. Compute Angular Coverage and Contiguous Gaps
  let coveredSectors = 0;
  for (let i = 0; i < NUM_SECTORS; i++) {
    if (sectorHits[i] === 1) coveredSectors++;
  }

  const coverage = coveredSectors / NUM_SECTORS;

  // Measure maximum contiguous gap of empty sectors (with circular wrap-around)
  let maxGapSectors = 0;
  let currentGap = 0;

  // Run through 2 cycles to easily handle circular wrap-around
  for (let i = 0; i < NUM_SECTORS * 2; i++) {
    const idx = i % NUM_SECTORS;
    if (sectorHits[idx] === 0) {
      currentGap++;
      if (currentGap > maxGapSectors) {
        maxGapSectors = currentGap;
      }
    } else {
      currentGap = 0;
    }
  }

  if (maxGapSectors > NUM_SECTORS) {
    maxGapSectors = NUM_SECTORS;
  }

  const maxGapAngle = (maxGapSectors / NUM_SECTORS) * 360;

  // 4. Determine Closure Status
  // A circle is CLOSED if:
  // - Largest opening gap is <= 32 degrees (allows small brush stroke overlap gaps)
  // - Overall angular coverage is >= 98%
  const isClosed = maxGapAngle <= 32 && coverage >= 0.98;
  const isOpen = !isClosed;

  return {
    hasCircle: true,
    isClosed,
    isOpen,
    coverage,
    maxGapAngle,
    radius: approxRadius,
    center: bestCandidate.center,
    circleCrop: bestCandidate,
    innerSigilsCount,
  };
}

/**
 * Helper that checks if the enclosing circle around all sigils is open.
 * Returns true if an enclosing circle exists and has an open gap, or false otherwise.
 */
export function isEnclosingCircleOpen(
  analysis: GlyphCompositionAnalysis | null | undefined,
  sourceCanvas?: HTMLCanvasElement | null
): boolean {
  if (!analysis || !analysis.rawCrops || analysis.rawCrops.length === 0) {
    return false;
  }
  const result = detectEnclosingCircle(analysis, sourceCanvas);
  return result.hasCircle && result.isOpen;
}

/**
 * Helper that checks if the enclosing circle around all sigils is fully closed.
 */
export function isEnclosingCircleClosed(
  analysis: GlyphCompositionAnalysis | null | undefined,
  sourceCanvas?: HTMLCanvasElement | null
): boolean {
  if (!analysis || !analysis.rawCrops || analysis.rawCrops.length === 0) {
    return false;
  }
  const result = detectEnclosingCircle(analysis, sourceCanvas);
  return result.hasCircle && result.isClosed;
}

// ==========================================
// Backwards Compatibility Re-Exports for ML
// (New code should import directly from './ml/model_trainer')
// ==========================================
export {
  trainModel,
  predictWithTrainedModel,
  getAllTrainingDataset,
  getSymbolMap,
  stopTraining,
} from '../ml/model_trainer';
export type { TrainingOptions, PredictionOptions } from '../ml/model_trainer';
