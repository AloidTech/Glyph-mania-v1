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

import {
  getCanvasDpr,
  type GlyphCompositionAnalysis,
  type SegmentedCrop,
  type Point,
  type BoundingBox,
} from '../ml/glyph_semantic_engine';

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
 * Detects the boundary circle around a glyph composition and determines
 * if it forms a closed loop or is open.
 *
 * Algorithm:
 * 1. Find the union bounding box of all symbols detected as part of the glyph
 *    (effector, cardinal directions, diagonal form augmentors).
 * 2. Find symbols that are outside or interacting outside with this bounding box,
 *    and choose the one that most looks like a circle based on aspect ratio,
 *    radial uniformity, and centering.
 * 3. Use pixel-level flood-fill with general gap tolerance (DPR-scaled) to check
 *    if the candidate forms a closed loop (trapping an interior pocket from the
 *    outside border) without relying on arbitrary percentages.
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

  // 1. Find the union bounding box of all symbols detected as part of the glyph
  const innerCrops: SegmentedCrop[] = [];
  if (analysis.spatial) {
    if (analysis.spatial.effectorComponents) {
      innerCrops.push(...analysis.spatial.effectorComponents);
    }
    if (analysis.spatial.directions) {
      for (const d of Object.values(analysis.spatial.directions)) {
        if (d) innerCrops.push(d);
      }
    }
    if (analysis.spatial.forms) {
      for (const formList of Object.values(analysis.spatial.forms)) {
        if (Array.isArray(formList)) {
          innerCrops.push(...formList);
        }
      }
    }
  }

  let unionBBox: BoundingBox;
  if (innerCrops.length > 0) {
    const minX = Math.min(...innerCrops.map((c) => c.bbox.x));
    const minY = Math.min(...innerCrops.map((c) => c.bbox.y));
    const maxX = Math.max(...innerCrops.map((c) => c.bbox.x + c.bbox.width));
    const maxY = Math.max(...innerCrops.map((c) => c.bbox.y + c.bbox.height));
    unionBBox = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  } else {
    // Fallback if inner slots are not yet categorized: use all smaller non-giant crops
    const nonGiant = crops.filter((c) => c.bbox.width < canvasW * 0.75 && c.bbox.height < canvasH * 0.75);
    const pool = nonGiant.length > 0 ? nonGiant : crops;
    const minX = Math.min(...pool.map((c) => c.bbox.x));
    const minY = Math.min(...pool.map((c) => c.bbox.y));
    const maxX = Math.max(...pool.map((c) => c.bbox.x + c.bbox.width));
    const maxY = Math.max(...pool.map((c) => c.bbox.y + c.bbox.height));
    unionBBox = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }

  const unionCenterX = unionBBox.x + unionBBox.width / 2;
  const unionCenterY = unionBBox.y + unionBBox.height / 2;
  const innerCropIndices = new Set(innerCrops.map((c) => c.index));

  // 2. Find symbols outside or outside-interacting with this union bounding box,
  //    and choose the one that most looks like a circle.
  let bestCandidate: SegmentedCrop | null = null;
  let bestCircleScore = -1;

  // Collect all outer candidate crops that could form or participate in the enclosing ring
  const outerCandidates: SegmentedCrop[] = [];
  const minDim = Math.min(canvasW, canvasH);
  const minCropSpan = Math.max(40, minDim * 0.22);

  for (const crop of crops) {
    if (
      innerCropIndices.has(crop.index) &&
      crop.bbox.width < unionBBox.width * 0.8 &&
      crop.bbox.height < unionBBox.height * 0.8
    ) {
      continue;
    }

    const { x, y, width, height } = crop.bbox;
    const cropRight = x + width;
    const cropBottom = y + height;
    const unionRight = unionBBox.x + unionBBox.width;
    const unionBottom = unionBBox.y + unionBBox.height;

    // Check if crop interacts with or spans outside the union box
    const margin = 16;
    const spansLeft = x <= unionBBox.x + margin;
    const spansRight = cropRight >= unionRight - margin;
    const spansTop = y <= unionBBox.y + margin;
    const spansBottom = cropBottom >= unionBottom - margin;

    const spanCount =
      (spansLeft ? 1 : 0) + (spansRight ? 1 : 0) + (spansTop ? 1 : 0) + (spansBottom ? 1 : 0);
    const isOutsideInteracting =
      spanCount >= 2 &&
      (width >= unionBBox.width * 0.65 || height >= unionBBox.height * 0.65);

    if (!isOutsideInteracting && (width < minCropSpan || height < minCropSpan)) {
      continue;
    }

    outerCandidates.push(crop);

    // Evaluate circle appearance:
    const aspect = width / (height || 1);
    if (aspect < 0.40 || aspect > 2.5) continue;
    const aspectScore = Math.max(0, 1 - Math.abs(aspect - 1.0) / 0.6);

    // Compute radial uniformity of stroke pixels around crop center
    const cropCanvas = crop.canvas;
    const cctx = cropCanvas.getContext('2d');
    if (!cctx) continue;

    const imgData = cctx.getImageData(0, 0, cropCanvas.width, cropCanvas.height);
    const data = imgData.data;
    const cropCenterX = cropCanvas.width / 2;
    const cropCenterY = cropCanvas.height / 2;

    let strokePixCount = 0;
    let sumR = 0;
    let sumR2 = 0;

    for (let py = 0; py < cropCanvas.height; py++) {
      for (let px = 0; px < cropCanvas.width; px++) {
        if (data[(py * cropCanvas.width + px) * 4 + 3] >= 20) {
          strokePixCount++;
          const dist = Math.hypot(px - cropCenterX, py - cropCenterY);
          sumR += dist;
          sumR2 += dist * dist;
        }
      }
    }

    if (strokePixCount < 30) continue;

    const meanR = sumR / strokePixCount;
    const varianceR = Math.max(0, sumR2 / strokePixCount - meanR * meanR);
    const stdDevR = Math.sqrt(varianceR);
    const coeffVar = meanR > 0 ? stdDevR / meanR : 1;

    // In a circle, stroke pixels lie around radius meanR with low variance
    const radialUniformityScore = Math.max(0, 1 - coeffVar / 0.35);

    // Centeredness relative to the inner glyph union center
    const distToUnionCenter = Math.hypot(crop.center.x - unionCenterX, crop.center.y - unionCenterY);
    const centerScore = Math.max(0, 1 - distToUnionCenter / (Math.max(canvasW, canvasH) * 0.45));

    // Outer enclosure score
    const enclosureScore = spanCount / 4;

    const circleScore =
      radialUniformityScore * 0.45 + aspectScore * 0.25 + centerScore * 0.15 + enclosureScore * 0.15;

    if (circleScore > bestCircleScore) {
      bestCircleScore = circleScore;
      bestCandidate = crop;
    }
  }

  // Helper to test if a given canvas contains a closed loop
  const dpr = getCanvasDpr(sourceCanvas);
  const gapTolerance = Math.max(2, Math.round(2.5 * dpr));

  const testLoopClosure = (canvas: HTMLCanvasElement): {
    isClosed: boolean;
    coverage: number;
    maxGapAngle: number;
    approxRadius: number;
  } => {
    const cw = canvas.width;
    const ch = canvas.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return { isClosed: false, coverage: 0, maxGapAngle: 360, approxRadius: Math.min(cw, ch) / 2 };
    }

    const imgData = ctx.getImageData(0, 0, cw, ch);
    const data = imgData.data;

    // 1. Build stroke barrier mask dilated by gapTolerance
    const isBarrier = new Uint8Array(cw * ch);
    const R = gapTolerance;
    const R2 = R * R;

    for (let py = 0; py < ch; py++) {
      for (let px = 0; px < cw; px++) {
        if (data[(py * cw + px) * 4 + 3] >= 20) {
          for (let dy = -R; dy <= R; dy++) {
            const ny = py + dy;
            if (ny < 0 || ny >= ch) continue;
            for (let dx = -R; dx <= R; dx++) {
              const nx = px + dx;
              if (nx < 0 || nx >= cw) continue;
              if (dx * dx + dy * dy <= R2) {
                isBarrier[ny * cw + nx] = 1;
              }
            }
          }
        }
      }
    }

    // 2. Outside BFS flood-fill from canvas borders
    const visitedOutside = new Uint8Array(cw * ch);
    const queue = new Int32Array(cw * ch);
    let qHead = 0;
    let qTail = 0;

    // Enqueue top and bottom borders
    for (let x = 0; x < cw; x++) {
      const topIdx = x;
      const botIdx = (ch - 1) * cw + x;
      if (!isBarrier[topIdx] && !visitedOutside[topIdx]) {
        visitedOutside[topIdx] = 1;
        queue[qTail++] = topIdx;
      }
      if (!isBarrier[botIdx] && !visitedOutside[botIdx]) {
        visitedOutside[botIdx] = 1;
        queue[qTail++] = botIdx;
      }
    }

    // Enqueue left and right borders
    for (let y = 0; y < ch; y++) {
      const leftIdx = y * cw;
      const rightIdx = y * cw + (cw - 1);
      if (!isBarrier[leftIdx] && !visitedOutside[leftIdx]) {
        visitedOutside[leftIdx] = 1;
        queue[qTail++] = leftIdx;
      }
      if (!isBarrier[rightIdx] && !visitedOutside[rightIdx]) {
        visitedOutside[rightIdx] = 1;
        queue[qTail++] = rightIdx;
      }
    }

    while (qHead < qTail) {
      const curr = queue[qHead++];
      const cx = curr % cw;
      const cy = (curr / cw) | 0;

      if (cy > 0) {
        const n = curr - cw;
        if (!isBarrier[n] && !visitedOutside[n]) {
          visitedOutside[n] = 1;
          queue[qTail++] = n;
        }
      }
      if (cy < ch - 1) {
        const n = curr + cw;
        if (!isBarrier[n] && !visitedOutside[n]) {
          visitedOutside[n] = 1;
          queue[qTail++] = n;
        }
      }
      if (cx > 0) {
        const n = curr - 1;
        if (!isBarrier[n] && !visitedOutside[n]) {
          visitedOutside[n] = 1;
          queue[qTail++] = n;
        }
      }
      if (cx < cw - 1) {
        const n = curr + 1;
        if (!isBarrier[n] && !visitedOutside[n]) {
          visitedOutside[n] = 1;
          queue[qTail++] = n;
        }
      }
    }

    // 3. Inspect trapped interior pixels near center
    const midX = cw / 2;
    const midY = ch / 2;
    const approxRadius = Math.min(cw, ch) / 2 - 12;
    const innerCheckRadius = Math.max(10, approxRadius * 0.35);
    const innerCheckRadius2 = innerCheckRadius * innerCheckRadius;

    let trappedInteriorCount = 0;
    let trappedNearCenterCount = 0;

    for (let y = 0; y < ch; y++) {
      for (let x = 0; x < cw; x++) {
        const idx = y * cw + x;
        if (!isBarrier[idx] && !visitedOutside[idx]) {
          trappedInteriorCount++;
          const d2 = (x - midX) * (x - midX) + (y - midY) * (y - midY);
          if (d2 <= innerCheckRadius2) {
            trappedNearCenterCount++;
          }
        }
      }
    }

    // 4. Measure angular coverage and contiguous gap with 72-bin angular histogram (5° per bin)
    const NUM_BINS = 72;
    const angularBins = new Uint8Array(NUM_BINS);
    const minR = Math.max(6, approxRadius * 0.4);
    const maxR = approxRadius * 1.6;

    for (let py = 0; py < ch; py++) {
      for (let px = 0; px < cw; px++) {
        if (data[(py * cw + px) * 4 + 3] >= 20) {
          const dx = px - midX;
          const dy = py - midY;
          const dist = Math.hypot(dx, dy);
          if (dist >= minR && dist <= maxR) {
            let ang = Math.atan2(dy, dx);
            if (ang < 0) ang += 2 * Math.PI;
            const bin = Math.min(NUM_BINS - 1, Math.floor((ang / (2 * Math.PI)) * NUM_BINS));
            angularBins[bin] = 1;
          }
        }
      }
    }

    let coveredBins = 0;
    for (let b = 0; b < NUM_BINS; b++) {
      if (angularBins[b]) coveredBins++;
    }
    const realCoverage = coveredBins / NUM_BINS;

    // Largest contiguous empty bin sequence (wrapping 360°)
    let maxGapBins = 0;
    let currGapBins = 0;
    for (let i = 0; i < NUM_BINS * 2; i++) {
      const b = i % NUM_BINS;
      if (!angularBins[b]) {
        currGapBins++;
        if (currGapBins > maxGapBins) maxGapBins = currGapBins;
      } else {
        currGapBins = 0;
      }
    }
    maxGapBins = Math.min(NUM_BINS, maxGapBins);
    const measuredGapAngle = Math.round((maxGapBins / NUM_BINS) * 360);

    const minRequiredEnclosedArea = Math.PI * Math.pow(Math.max(12, approxRadius * 0.25), 2);
    const isClosed = trappedInteriorCount >= minRequiredEnclosedArea && trappedNearCenterCount >= 8;

    return {
      isClosed,
      coverage: isClosed ? Math.max(0.92, realCoverage) : realCoverage,
      maxGapAngle: isClosed ? Math.min(10, measuredGapAngle) : Math.max(15, measuredGapAngle),
      approxRadius,
    };
  };

  // Evaluate candidate(s)
  let loopEval: ReturnType<typeof testLoopClosure> | null = null;
  let chosenCrop: SegmentedCrop | null = null;

  if (bestCandidate && bestCircleScore >= 0.25) {
    loopEval = testLoopClosure(bestCandidate.canvas);
    chosenCrop = bestCandidate;
  }

  // If single candidate didn't close or wasn't found, check if multiple outer strokes together form a closed ring
  if ((!loopEval || !loopEval.isClosed) && outerCandidates.length >= 2) {
    const multiMinX = Math.min(...outerCandidates.map((c) => c.bbox.x));
    const multiMinY = Math.min(...outerCandidates.map((c) => c.bbox.y));
    const multiMaxX = Math.max(...outerCandidates.map((c) => c.bbox.x + c.bbox.width));
    const multiMaxY = Math.max(...outerCandidates.map((c) => c.bbox.y + c.bbox.height));
    const pad = 16;
    const compW = (multiMaxX - multiMinX) + pad * 2;
    const compH = (multiMaxY - multiMinY) + pad * 2;

    const compCanvas = document.createElement('canvas');
    compCanvas.width = compW;
    compCanvas.height = compH;
    const compCtx = compCanvas.getContext('2d');
    if (compCtx) {
      for (const oc of outerCandidates) {
        compCtx.drawImage(
          oc.canvas,
          oc.bbox.x - multiMinX + pad - 12,
          oc.bbox.y - multiMinY + pad - 12
        );
      }
      const multiEval = testLoopClosure(compCanvas);
      if (multiEval.isClosed || !loopEval) {
        loopEval = multiEval;
        const mergedBBox: BoundingBox = {
          x: multiMinX,
          y: multiMinY,
          width: multiMaxX - multiMinX,
          height: multiMaxY - multiMinY,
        };
        chosenCrop = {
          index: 999,
          canvas: compCanvas,
          dataUrl: compCanvas.toDataURL('image/png'),
          bbox: mergedBBox,
          center: { x: multiMinX + mergedBBox.width / 2, y: multiMinY + mergedBBox.height / 2 },
          pixelCount: outerCandidates.reduce((sum, c) => sum + c.pixelCount, 0),
        };
      }
    }
  }

  if (!chosenCrop || !loopEval) {
    return DEFAULT_NO_CIRCLE;
  }

  const approxRadius = (chosenCrop.bbox.width + chosenCrop.bbox.height) / 4;

  return {
    hasCircle: true,
    isClosed: loopEval.isClosed,
    isOpen: !loopEval.isClosed,
    coverage: loopEval.coverage,
    maxGapAngle: loopEval.maxGapAngle,
    radius: approxRadius,
    center: chosenCrop.center,
    circleCrop: chosenCrop,
    innerSigilsCount: innerCrops.length,
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
