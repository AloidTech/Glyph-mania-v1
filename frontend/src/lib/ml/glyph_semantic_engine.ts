/**
 * ============================================================================
 * GLYPH SEMANTIC ENGINE - SPATIAL SEGMENTATION & ML RECOGNITION
 * ============================================================================
 *
 * This module is the core arcane glyph processing and recognition pipeline.
 * It is responsible for:
 *
 * 1. Pixel-Level Segmentation:
 *    - Extracting individual connected components (strokes/symbols) from a canvas
 *      using a 4-connectivity flood fill with DPR-aware gap tolerance.
 *    - Isolating and filtering noise artifacts and distinguishing internal glyph
 *      strokes from outer enclosing circles / perimeter arcs.
 *
 * 2. Spatial Slot Classification:
 *    - Identifying the four Cardinal Direction Anchors (Top, Right, Bottom, Left)
 *      representing Positional augmentors pointing toward the center.
 *    - Setting the strict boundary box for the Central Effector based on the inner
 *      tips of the cardinal anchors.
 *    - Isolating Central Effector strokes (e.g. Fire, Water, Force, etc.).
 *    - Detecting Corner / Diagonal Form Augmentors (Top-Left/NW, Top-Right/NE,
 *      Bottom-Left/SW, Bottom-Right/SE) via dedicated quadrant flood-fill zones.
 *
 * 3. Machine Learning Inference & Canonical Resolution:
 *    - Preprocessing cropped symbol canvases into normalized MobileNet inputs.
 *    - Extracting high-dimensional feature embeddings.
 *    - Classifying embeddings via trained neural network transfer weights or
 *      k-NN exemplar distance matching.
 *    - Resolving recognized labels to canonical database sigil records.
 *
 * 4. Multi-Component Effector Failsafe:
 *    - When the central effector recognition confidence is below 20% (< 0.20),
 *      evaluates combinations of the 4 closest interior symbols (up to 15 combos)
 *      to dynamically reconstruct complex multi-stroke effectors.
 *
 * ============================================================================
 */

import * as tf from '@tensorflow/tfjs';
import { getOrLoadEmbeddingModel, toModelInput, embedDrawing, classifyEmbedding } from './embedding_engine';
import { useTrainingStore } from './training_store';
import { useAdminSigilsStore } from '../stores/admin_sigils_store';
import { predictWithTrainedModel } from './model_trainer';
import { resolveCanonicalSigil } from '../glyph_helpers/sigils';

// ============================================================================
// SECTION 1: DATA TYPES & INTERFACES
// ============================================================================

/**
 * 2D bounding rectangle in canvas pixel coordinates.
 */
export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * 2D point coordinate.
 */
export interface Point {
  x: number;
  y: number;
}

/**
 * Represents a single connected component (stroke/mark) isolated from the canvas.
 */
export interface SegmentedCrop {
  /** Offscreen canvas containing only the pixels of this segmented component */
  canvas: HTMLCanvasElement;
  /** Base64 PNG data URL of the isolated component canvas */
  dataUrl: string;
  /** Total count of non-transparent pixels in this component */
  pixelCount: number;
  /** 1-based unique identifier assigned during segmentation */
  index: number;
  /** Axis-aligned bounding box of the component in source canvas coordinates */
  bbox: BoundingBox;
  /** Geometric center of the bounding box */
  center: Point;
}

/**
 * The four cardinal direction slots representing position augmentor anchors.
 */
export interface DirectionSlots {
  /** Top position augmentor (↑, -π/2) */
  top?: SegmentedCrop;
  /** Right position augmentor (→, 0) */
  right?: SegmentedCrop;
  /** Bottom position augmentor (↓, π/2) */
  bottom?: SegmentedCrop;
  /** Left position augmentor (←, π) */
  left?: SegmentedCrop;
}

/**
 * The four corner form augmentor slots (Dash, Curve, Spiral, etc.).
 */
export interface FormSlots {
  /** Northwest / Top-Left corner form symbols */
  topLeft: SegmentedCrop[];
  /** Northeast / Top-Right corner form symbols */
  topRight: SegmentedCrop[];
  /** Southwest / Bottom-Left corner form symbols */
  bottomLeft: SegmentedCrop[];
  /** Southeast / Bottom-Right corner form symbols */
  bottomRight: SegmentedCrop[];
}

/**
 * Search quadrant boundary used during zone-based diagonal form detection.
 */
export interface DiagonalSearchZone {
  /** Quadrant identifier: North-West, North-East, South-West, South-East */
  corner: 'NW' | 'NE' | 'SW' | 'SE';
  /** Corresponding key in FormSlots */
  key: keyof FormSlots;
  /** Human-readable display label */
  label: string;
  /** Pixel bounds of the search zone in source canvas coordinates */
  bounds: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    width: number;
    height: number;
  };
}

/**
 * Output of the spatial classification phase.
 */
export interface SpatialAnalysisResult {
  /** Dynamic center point computed from the union of drawn glyph symbols */
  center: Point;
  /** Assigned cardinal direction symbols */
  directions: DirectionSlots;
  /**
   * Search bounding box for the central effector, strictly bounded by the
   * inner edges of the four cardinal direction anchors.
   */
  region: { left: number; right: number; top: number; bottom: number };
  /** Segmented components assigned to the central effector */
  effectorComponents: SegmentedCrop[];
  /** Segmented components assigned to corner form augmentors */
  forms: FormSlots;
  /** Corner search zone definitions for UI debugging and boundary visualization */
  diagonalZones?: DiagonalSearchZone[];
  /** All segmented items annotated with polar offset from the dynamic center */
  items: (SegmentedCrop & { cx: number; cy: number; dx: number; dy: number; angle: number; dist: number })[];
}

/**
 * ML classification result for a single semantic slot.
 */
export interface RecognitionItemResult {
  /** Unique ID of the matched canonical sigil (e.g. 'eff-fire', 'aug-position') */
  sigilId?: string | null;
  /** Canonical label (e.g. 'Fire', 'Position', 'Dash') */
  label: string | null;
  /** Confidence score between 0.0 and 1.0 */
  confidence: number | null;
  /** Whether the model made a definitive prediction */
  available: boolean;
  /** Full probability/confidence distribution across all candidate classes */
  confidences?: Record<string, number>;
}

/**
 * Structured semantic crop package for a specific glyph slot (used by training and UI).
 */
export interface SemanticCropItem {
  key: string;
  title: string;
  role: 'effector' | 'direction' | 'form';
  canvas: HTMLCanvasElement | null;
  dataUrl: string | null;
  componentCount: number;
  recognition: RecognitionItemResult;
}

/**
 * Complete result of the end-to-end glyph composition analysis pipeline.
 */
export interface GlyphCompositionAnalysis {
  /** All raw segmented connected components before classification */
  rawCrops: SegmentedCrop[];
  /** Spatial mapping results (cardinals, forms, central effector bounds) */
  spatial: SpatialAnalysisResult;
  /** Isolated composite canvas of the central effector */
  effectorCrop: HTMLCanvasElement | null;
  /** Tight bounding box surrounding the central effector components */
  effectorBBox?: BoundingBox;
  /** Diagonal quadrant search zones used for form detection */
  diagonalZones?: DiagonalSearchZone[];
  /** Dictionary of semantic crop items keyed by slot name */
  semanticCrops: Record<string, SemanticCropItem>;
  /** High-level summary metrics of the analyzed composition */
  summary: {
    effectorCount: number;
    directionsCount: number;
    formsCount: number;
    totalComponents: number;
  };
}

// ============================================================================
// SECTION 2: DEVICE METRICS & DPR SCALING
// ============================================================================

/**
 * Detects the effective Device Pixel Ratio (DPR) by comparing a canvas's
 * backing-store pixel dimensions to its CSS display dimensions.
 *
 * Why this matters:
 * On high-DPR mobile and Retina displays, the canvas backing store is 2-3x larger
 * than the CSS layout size. A 1px visual gap drawn by the user occupies 2-3 real
 * pixels in memory. Without scaling by DPR, flood-fill gap tolerances and noise
 * rejection floors would behave differently across devices.
 *
 * @param canvas - Optional HTML canvas element to measure
 * @returns Effective DPR scale factor (clamped between 0.5 and 8.0)
 */
export function getCanvasDpr(canvas?: HTMLCanvasElement | null): number {
  if (typeof window === 'undefined') return 1;
  const dpr = window.devicePixelRatio || 1;

  if (canvas) {
    const cssW = canvas.clientWidth;
    if (cssW > 0 && canvas.width > 0) {
      const measured = canvas.width / cssW;
      // Sanity-clamp: off-screen canvases may report 0 CSS width
      if (measured >= 0.5 && measured <= 8) return measured;
    }
  }

  return dpr;
}

// ============================================================================
// SECTION 3: CONNECTED-COMPONENT SEGMENTATION (FLOOD FILL)
// ============================================================================

/**
 * Segments an HTML canvas into isolated symbol crops using a 4-connectivity
 * flood fill with adaptive gap tolerance and noise filtering.
 *
 * Algorithm overview:
 * 1. Reads the full canvas RGBA image buffer.
 * 2. Scans for unvisited pixels exceeding the alpha threshold.
 * 3. Expands a flood-fill stack with an adaptive neighborhood radius (`gapTolerance`),
 *    allowing small gaps within hand-drawn strokes to remain connected as a single blob.
 * 4. Filters out noise blobs smaller than `absoluteFloorPixels` or statistically
 *    negligible compared to the average stroke size.
 *    (Crucial: Giant enclosing circles are excluded when computing the average
 *    so thin internal strokes aren't accidentally discarded as outliers).
 * 5. Generates isolated offscreen canvases for each valid blob with generous padding.
 * 6. Sorts crops top-to-bottom and left-to-right for consistent indexing.
 *
 * @param sourceCanvas - The source canvas containing hand-drawn glyph strokes
 * @param opts - Tuning parameters for segmentation thresholds and gap tolerance
 * @returns Array of segmented symbol crops with isolated canvases and bounding boxes
 */
export function segmentSymbols(
  sourceCanvas: HTMLCanvasElement,
  opts: {
    /** Alpha channel threshold (0-255) to consider a pixel active. Default: 20 */
    alphaThreshold?: number;
    /** Ratio of average pixel count below which small blobs are dropped. Default: 0.35 */
    outlierRatio?: number;
    /** Minimum blob count required to activate mean-based outlier filtering. Default: 2 */
    minBlobsForMeanFilter?: number;
    /** Absolute minimum pixel count required to accept a blob. Scaled by dpr². Default: 35 * dpr² */
    absoluteFloorPixels?: number;
    /** Padding in pixels around each isolated crop canvas. Default: 12 */
    padding?: number;
    /** Neighborhood radius for bridging stroke gaps. Default: Math.round(1 * dpr) */
    gapTolerance?: number;
    /** Device pixel ratio — auto-detected from sourceCanvas if omitted */
    dpr?: number;
  } = {}
): SegmentedCrop[] {
  const dpr = opts.dpr ?? getCanvasDpr(sourceCanvas);
  const {
    alphaThreshold = 20,
    outlierRatio = 0.35,
    minBlobsForMeanFilter = 2,
    // Area thresholds scale quadratically by dpr (pixels are 2D area)
    absoluteFloorPixels = Math.round(35 * dpr * dpr),
    padding = 12,
    // Distance thresholds scale linearly by dpr
    gapTolerance = Math.max(1, Math.round(1 * dpr)),
  } = opts;

  const w = sourceCanvas.width;
  const h = sourceCanvas.height;
  if (!w || !h) return [];

  const ctx = sourceCanvas.getContext('2d');
  if (!ctx) return [];

  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  // Label buffer: 0 = unvisited, >0 = blob label ID
  const labels = new Int32Array(w * h);
  let nextLabel = 0;
  const stack = new Int32Array(w * h);

  function alphaAt(idx: number): number {
    return data[idx * 4 + 3];
  }

  interface RawBlob {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    pixelCount: number;
    label: number;
  }

  const allBlobs: RawBlob[] = [];

  // Scan every pixel to discover connected stroke components
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      if (labels[idx] !== 0) continue;
      if (alphaAt(idx) < alphaThreshold) continue;

      nextLabel++;
      let sp = 0;
      stack[sp++] = idx;
      labels[idx] = nextLabel;

      let minX = x,
        maxX = x,
        minY = y,
        maxY = y,
        pixelCount = 0;

      // Expand flood-fill stack
      while (sp > 0) {
        const cur = stack[--sp];
        const cx = cur % w;
        const cy = (cur / w) | 0;
        pixelCount++;

        if (cx < minX) minX = cx;
        if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy;
        if (cy > maxY) maxY = cy;

        // Gap-tolerant connectivity: check neighborhood within radius R
        const R = gapTolerance;
        const R2 = R * R;
        const startX = Math.max(0, cx - R);
        const endX = Math.min(w - 1, cx + R);
        const startY = Math.max(0, cy - R);
        const endY = Math.min(h - 1, cy + R);

        for (let ny = startY; ny <= endY; ny++) {
          for (let nx = startX; nx <= endX; nx++) {
            const n = ny * w + nx;
            // Fast reject before expensive Euclidean distance math
            if (labels[n] === 0 && data[n * 4 + 3] >= alphaThreshold) {
              const dx = nx - cx;
              const dy = ny - cy;
              if (dx * dx + dy * dy <= R2) {
                labels[n] = nextLabel;
                stack[sp++] = n;
              }
            }
          }
        }
      }

      allBlobs.push({ minX, minY, maxX, maxY, pixelCount, label: nextLabel });
    }
  }

  // Filter out noise marks — ignore giant outer enclosing circles when computing mean
  const regularBlobs = allBlobs.filter(
    (b) => (b.maxX - b.minX) < w * 0.55 || (b.maxY - b.minY) < h * 0.55
  );
  const blobPoolForMean = regularBlobs.length > 0 ? regularBlobs : allBlobs;

  let blobs: RawBlob[];
  if (blobPoolForMean.length >= minBlobsForMeanFilter) {
    const meanPixelCount = blobPoolForMean.reduce((sum, b) => sum + b.pixelCount, 0) / blobPoolForMean.length;
    const outlierThreshold = Math.max(absoluteFloorPixels, meanPixelCount * outlierRatio);
    blobs = allBlobs.filter((b) => b.pixelCount >= outlierThreshold);
  } else {
    blobs = allBlobs.filter((b) => b.pixelCount >= absoluteFloorPixels);
  }

  // Create isolated canvas crop for each connected blob
  const crops: SegmentedCrop[] = blobs.map((blob, i) => {
    const bw = blob.maxX - blob.minX + 1;
    const bh = blob.maxY - blob.minY + 1;
    const cropW = bw + padding * 2;
    const cropH = bh + padding * 2;

    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = cropW;
    cropCanvas.height = cropH;
    const cropCtx = cropCanvas.getContext('2d')!;

    const cropImgData = cropCtx.createImageData(cropW, cropH);
    for (let y = 0; y < bh; y++) {
      for (let x = 0; x < bw; x++) {
        const srcX = blob.minX + x;
        const srcY = blob.minY + y;
        const srcIdx = srcY * w + srcX;
        if (labels[srcIdx] !== blob.label) continue;

        const srcPixel = srcIdx * 4;
        const dstX = x + padding;
        const dstY = y + padding;
        const dstPixel = (dstY * cropW + dstX) * 4;

        cropImgData.data[dstPixel] = data[srcPixel];
        cropImgData.data[dstPixel + 1] = data[srcPixel + 1];
        cropImgData.data[dstPixel + 2] = data[srcPixel + 2];
        cropImgData.data[dstPixel + 3] = data[srcPixel + 3];
      }
    }
    cropCtx.putImageData(cropImgData, 0, 0);

    return {
      canvas: cropCanvas,
      dataUrl: cropCanvas.toDataURL('image/png'),
      pixelCount: blob.pixelCount,
      index: i + 1,
      bbox: { x: blob.minX, y: blob.minY, width: bw, height: bh },
      center: { x: (blob.minX + blob.maxX) / 2, y: (blob.minY + blob.maxY) / 2 },
    };
  });

  // Sort logically top-to-bottom, left-to-right
  const ordered = blobs
    .map((blob, i) => ({ blob, crop: crops[i] }))
    .sort((a, b) => {
      if (Math.abs(a.blob.minY - b.blob.minY) > 40) return a.blob.minY - b.blob.minY;
      return a.blob.minX - b.blob.minX;
    })
    .map((item, i) => ({ ...item.crop, index: i + 1 }));

  return ordered;
}

// ============================================================================
// SECTION 4: GEOMETRIC HELPERS & ENCLOSING CIRCLE DISCRIMINATION
// ============================================================================

/**
 * Computes the shortest angular distance between two angles on the circle [-π, π].
 *
 * @param a - First angle in radians
 * @param b - Second angle in radians
 * @returns Angular difference in radians [0, π]
 */
function angleDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % (Math.PI * 2);
  return d > Math.PI ? Math.PI * 2 - d : d;
}

/**
 * Detects whether a segmented crop represents an outer enclosing circle or
 * an arc segment of one, based on its bounding footprint and radial distance.
 *
 * Used to prevent boundary rings from being erroneously classified as cardinal
 * arrows, central effectors, or corner form sigils.
 *
 * Criteria:
 * 1. Full Enclosing Circle:
 *    - Width and height span >= 50% of the canvas minimum dimension.
 *    - Center of the crop encloses the canvas center.
 * 2. Large Arc Segment:
 *    - Width or height spans >= 40% of the canvas minimum dimension.
 *    - The center of the stroke lies in the outer perimeter (dist >= 28% of canvas size).
 *
 * @param crop - The candidate segmented crop
 * @param canvasW - Canvas width in pixels
 * @param canvasH - Canvas height in pixels
 * @param cx - Canvas center X coordinate
 * @param cy - Canvas center Y coordinate
 * @returns True if the crop is an enclosing circle or outer perimeter arc
 */
export function isEnclosingCircleCandidate(
  crop: SegmentedCrop,
  canvasW: number,
  canvasH: number,
  cx: number,
  cy: number
): boolean {
  const { width, height, x, y } = crop.bbox;
  const minDim = Math.min(canvasW, canvasH);

  // 1. Full enclosing circle: wide and tall, surrounding center
  if (width >= minDim * 0.50 && height >= minDim * 0.50) {
    const enclosesCenter =
      x <= cx + 50 &&
      x + width >= cx - 50 &&
      y <= cy + 50 &&
      y + height >= cy - 50;
    if (enclosesCenter) return true;
  }

  // 2. Large arc segment of enclosing circle:
  // Must span large dimension and lie at the outer perimeter
  if (width >= minDim * 0.40 || height >= minDim * 0.40) {
    const distFromCenter = Math.hypot(crop.center.x - cx, crop.center.y - cy);
    if (distFromCenter >= minDim * 0.28) {
      return true;
    }
  }

  return false;
}

// ============================================================================
// SECTION 5: SPATIAL SLOT CLASSIFICATION (CARDINALS & EFFECTOR BOUNDS)
// ============================================================================

/**
 * Analyzes the spatial layout of segmented components across the glyph canvas.
 *
 * Responsibilities:
 * 1. Computes the dynamic center of mass from the bounding box union of internal
 *    drawn components (excluding any outer enclosing circle).
 * 2. Maps each component's polar position (angle, radial distance) relative to center.
 * 3. Classifies the four Cardinal Direction Anchors (top, bottom, left, right)
 *    by scoring angular alignment and radial distance away from center.
 * 4. Determines the strict Central Effector search region (`spatial.region`), defined
 *    by the inner tips of the four cardinal anchors:
 *    - left: `directions.left.bbox.right + 2`
 *    - right: `directions.right.bbox.left - 2`
 *    - top: `directions.top.bbox.bottom + 2`
 *    - bottom: `directions.bottom.bbox.top - 2`
 *    (Falls back to an 18% central radius if cardinal anchors are missing).
 * 5. Collects all internal components whose centers fall strictly within this region
 *    as candidate effector strokes.
 *
 * @param crops - Array of segmented symbol crops from segmentSymbols
 * @param w - Canvas width
 * @param h - Canvas height
 * @returns SpatialAnalysisResult containing classified slots and effector boundaries
 */
export function classifyGlyphSpatialSlots(crops: SegmentedCrop[], w: number, h: number): SpatialAnalysisResult {
  // Dynamically compute center from bounding box union of internal drawn components (ignoring outer circle)
  let center: Point = { x: w / 2, y: h / 2 };
  let glyphSpan = Math.min(w, h);

  const innerCrops = crops.filter(
    (c) => !isEnclosingCircleCandidate(c, w, h, w / 2, h / 2) && (c.bbox.width < w * 0.55 || c.bbox.height < h * 0.55)
  );
  const pool = innerCrops.length > 0 ? innerCrops : crops;

  if (pool.length > 0) {
    const minX = Math.min(...pool.map((c) => c.bbox.x));
    const maxX = Math.max(...pool.map((c) => c.bbox.x + c.bbox.width));
    const minY = Math.min(...pool.map((c) => c.bbox.y));
    const maxY = Math.max(...pool.map((c) => c.bbox.y + c.bbox.height));

    center = {
      x: (minX + maxX) / 2,
      y: (minY + maxY) / 2,
    };
    glyphSpan = Math.max(maxX - minX, maxY - minY);
  }

  const items = crops.map((c) => {
    const p = c.center || { x: c.bbox.x + c.bbox.width / 2, y: c.bbox.y + c.bbox.height / 2 };
    const dx = p.x - center.x;
    const dy = p.y - center.y;
    return {
      ...c,
      cx: p.x,
      cy: p.y,
      dx,
      dy,
      angle: Math.atan2(dy, dx),
      dist: Math.hypot(dx, dy),
    };
  });

  // Cardinal target angles in radians: right=0, bottom=π/2, left=π, top=-π/2
  const target: Record<'right' | 'bottom' | 'left' | 'top', number> = {
    right: 0,
    bottom: Math.PI / 2,
    left: Math.PI,
    top: -Math.PI / 2,
  };

  const directions: DirectionSlots = {};
  const used = new Set<number>();
  const minCardinalDist = Math.max(20, Math.min(w, h) * 0.14);

  // Match each cardinal slot to the best aligned component
  for (const [slot, a] of Object.entries(target) as [keyof typeof target, number][]) {
    const ranked = items
      .filter((x) => !used.has(x.index) && !isEnclosingCircleCandidate(x, w, h, center.x, center.y) && x.dist > minCardinalDist && x.bbox.width < w * 0.55 && x.bbox.height < h * 0.55)
      .map((x) => ({
        ...x,
        score: angleDistance(x.angle, a) + Math.max(0, Math.min(1, (glyphSpan * 0.3) / x.dist)) * 0.15,
      }))
      .sort((a, b) => a.score - b.score);

    if (ranked.length && ranked[0].score < 0.82) {
      directions[slot] = ranked[0];
      used.add(ranked[0].index);
    }
  }

  // Inner boundaries of Cardinal Anchors strictly determine the Effector region
  // When cardinal anchors are absent, use a central radius of 18% of canvas dimension
  const centralRadius = Math.min(w, h) * 0.18;
  let left = directions.left
    ? directions.left.bbox.x + directions.left.bbox.width + 2
    : center.x - centralRadius;
  let right = directions.right
    ? directions.right.bbox.x - 2
    : center.x + centralRadius;
  let top = directions.top
    ? directions.top.bbox.y + directions.top.bbox.height + 2
    : center.y - centralRadius;
  let bottom = directions.bottom
    ? directions.bottom.bbox.y - 2
    : center.y + centralRadius;

  // 1. Minimum span floor: ensure the search box never collapses to zero or inverts
  const minSpan = Math.min(w, h) * 0.12;
  if (right - left < minSpan) {
    left = center.x - minSpan / 2;
    right = center.x + minSpan / 2;
  }
  if (bottom - top < minSpan) {
    top = center.y - minSpan / 2;
    bottom = center.y + minSpan / 2;
  }

  // 2. Maximum center clamp:
  // Prevent the effector box from growing so large that it swallows the corners,
  // which happens if the cardinal arrows are drawn very far away.
  const maxRadius = Math.min(w, h) * 0.35; // The effector cannot extend beyond 35% of canvas from center (max 70% central square)
  left = Math.max(left, center.x - maxRadius);
  right = Math.min(right, center.x + maxRadius);
  top = Math.max(top, center.y - maxRadius);
  bottom = Math.min(bottom, center.y + maxRadius);

  const region = {
    left: Math.round(left),
    right: Math.round(right),
    top: Math.round(top),
    bottom: Math.round(bottom),
  };

  // Helper to test if a stroke center is genuinely within the central effector zone,
  // preventing diagonal corner marks from being swallowed into the effector.
  const inCentralEffectorZone = (pt: { cx: number; cy: number }) => {
    if (pt.cx < region.left || pt.cx > region.right) return false;
    if (pt.cy < region.top || pt.cy > region.bottom) return false;
    const dx = pt.cx - center.x;
    const dy = pt.cy - center.y;
    const spanX = dx >= 0 ? Math.max(10, region.right - center.x) : Math.max(10, center.x - region.left);
    const spanY = dy >= 0 ? Math.max(10, region.bottom - center.y) : Math.max(10, center.y - region.top);
    const normDistSq = (dx / spanX) * (dx / spanX) + (dy / spanY) * (dy / spanY);
    // Cardinal tips are at normDistSq = 1.0; outer diagonal corners are at normDistSq = 2.0
    // 1.15 cuts off the diagonal corner marks while allowing full reach to cardinal tips
    return normDistSq <= 1.15;
  };

  // Effector components: all central marks bounded strictly within the cardinal arrows
  const insideEffector = items.filter(
    (x) =>
      !used.has(x.index) &&
      !isEnclosingCircleCandidate(x, w, h, center.x, center.y) &&
      inCentralEffectorZone(x) &&
      x.bbox.width < w * 0.55 &&
      x.bbox.height < h * 0.55
  );
  insideEffector.forEach((x) => used.add(x.index));

  const forms: FormSlots = {
    topLeft: [],
    topRight: [],
    bottomLeft: [],
    bottomRight: [],
  };

  return { center, directions, region, effectorComponents: insideEffector, forms, items };
}

// ============================================================================
// SECTION 6: CORNER / DIAGONAL FORM AUGMENTOR DETECTION
// ============================================================================

/**
 * Zone-Based Diagonal Form Augmentor Detection.
 *
 * Implements corner quadrant search zones (NW, NE, SW, SE) extending from the outer
 * canvas corners to the boundaries of the cardinal anchors and central effector.
 *
 * Features:
 * 1. Dedicated DPR-scaled flood-fill segmentation per corner zone.
 * 2. Strict outer-perimeter arc rejection (ensuring enclosing circle strokes are never
 *    mistaken for form sigils).
 * 3. Inner edge bleed filtering (rejects tiny fragments that clipped across from neighboring
 *    cardinal arrows or central effector strokes).
 * 4. Coordinate offset mapping back to the global canvas space.
 * 5. Bounding-box deduplication against already-claimed cardinal and effector marks.
 * 6. Selects the dominant stroke in each quadrant as the primary form sigil.
 *
 * @param sourceCanvas - Canvas to search (typically innerCanvas with enclosing circle erased)
 * @param spatial - Spatial analysis result containing cardinal and effector positions
 * @param dpr - Device pixel ratio
 * @returns Assigned form slots and the bounding geometry of each diagonal search zone
 */
function detectCornerFormZones(
  sourceCanvas: HTMLCanvasElement,
  spatial: SpatialAnalysisResult,
  dpr: number
): { forms: FormSlots; diagonalZones: DiagonalSearchZone[] } {
  const w = sourceCanvas.width;
  const h = sourceCanvas.height;
  const ctx = sourceCanvas.getContext('2d');
  if (!ctx) return { forms: { topLeft: [], topRight: [], bottomLeft: [], bottomRight: [] }, diagonalZones: [] };

  const { directions, effectorComponents, items, center } = spatial;
  const cx = center?.x ?? w / 2;
  const cy = center?.y ?? h / 2;

  // Build a set of indices already claimed by cardinal directions and central effector
  const usedIndices = new Set<number>();
  for (const d of Object.values(directions)) {
    if (d) usedIndices.add((d as SegmentedCrop).index);
  }
  for (const e of effectorComponents) {
    usedIndices.add(e.index);
  }

  const usedBBoxes = items
    .filter((it) => usedIndices.has(it.index))
    .map((it) => it.bbox);

  const GAP_TOLERANCE = Math.max(2, Math.round(3 * dpr));
  const ALPHA_THRESHOLD = 20;
  const NOISE_FLOOR = Math.round(25 * dpr * dpr);
  const EDGE_MARGIN = Math.max(3, Math.round(3 * dpr));
  const EDGE_BLEED_RATIO = 0.60;

  interface CornerDef {
    key: keyof FormSlots;
    corner: 'NW' | 'NE' | 'SW' | 'SE';
    label: string;
    dirs: (keyof DirectionSlots)[];
  }

  const cornerDefs: CornerDef[] = [
    { key: 'topLeft', corner: 'NW', label: 'NW Form Zone', dirs: ['top', 'left'] },
    { key: 'topRight', corner: 'NE', label: 'NE Form Zone', dirs: ['top', 'right'] },
    { key: 'bottomLeft', corner: 'SW', label: 'SW Form Zone', dirs: ['bottom', 'left'] },
    { key: 'bottomRight', corner: 'SE', label: 'SE Form Zone', dirs: ['bottom', 'right'] },
  ];

  const forms: FormSlots = {
    topLeft: [],
    topRight: [],
    bottomLeft: [],
    bottomRight: [],
  };

  const diagonalZones: DiagonalSearchZone[] = [];

  for (const def of cornerDefs) {
    const parts: SegmentedCrop[] = def.dirs.map((d) => directions[d]).filter(Boolean) as SegmentedCrop[];
    if (effectorComponents.length > 0) {
      parts.push(...effectorComponents);
    }

    let minX: number;
    let minY: number;
    let maxX: number;
    let maxY: number;

    if (parts.length > 0) {
      const partsMinX = Math.min(...parts.map((p) => p.bbox.x));
      const partsMinY = Math.min(...parts.map((p) => p.bbox.y));
      const partsMaxX = Math.max(...parts.map((p) => p.bbox.x + p.bbox.width));
      const partsMaxY = Math.max(...parts.map((p) => p.bbox.y + p.bbox.height));

      if (def.corner === 'NW') {
        minX = 0;
        minY = 0;
        maxX = Math.max(cx, partsMaxX);
        maxY = Math.max(cy, partsMaxY);
      } else if (def.corner === 'NE') {
        minX = Math.min(cx, partsMinX);
        minY = 0;
        maxX = w;
        maxY = Math.max(cy, partsMaxY);
      } else if (def.corner === 'SW') {
        minX = 0;
        minY = Math.min(cy, partsMinY);
        maxX = Math.max(cx, partsMaxX);
        maxY = h;
      } else {
        // SE
        minX = Math.min(cx, partsMinX);
        minY = Math.min(cy, partsMinY);
        maxX = w;
        maxY = h;
      }
    } else {
      // Default four canvas quadrants from dynamic center
      if (def.corner === 'NW') { minX = 0; minY = 0; maxX = cx; maxY = cy; }
      else if (def.corner === 'NE') { minX = cx; minY = 0; maxX = w; maxY = cy; }
      else if (def.corner === 'SW') { minX = 0; minY = cy; maxX = cx; maxY = h; }
      else { minX = cx; minY = cy; maxX = w; maxY = h; }
    }

    const zoneW = Math.max(10, Math.round(maxX - minX));
    const zoneH = Math.max(10, Math.round(maxY - minY));
    minX = Math.round(minX);
    minY = Math.round(minY);
    maxX = minX + zoneW;
    maxY = minY + zoneH;

    const zoneBounds = {
      minX,
      minY,
      maxX,
      maxY,
      width: zoneW,
      height: zoneH,
    };

    diagonalZones.push({
      corner: def.corner,
      key: def.key,
      label: def.label,
      bounds: zoneBounds,
    });

    // 1. Create a cropped canvas for this corner zone
    const zoneCanvas = document.createElement('canvas');
    zoneCanvas.width = zoneW;
    zoneCanvas.height = zoneH;
    const zoneCtx = zoneCanvas.getContext('2d');
    if (!zoneCtx) continue;

    zoneCtx.drawImage(sourceCanvas, minX, minY, zoneW, zoneH, 0, 0, zoneW, zoneH);

    // 2. Run flood-fill segmentation with DPR-scaled gap tolerance
    const blobs = segmentSymbols(zoneCanvas, {
      alphaThreshold: ALPHA_THRESHOLD,
      outlierRatio: 0.25,
      absoluteFloorPixels: NOISE_FLOOR,
      padding: 12,
      gapTolerance: GAP_TOLERANCE,
      dpr,
    });

    if (blobs.length === 0) continue;

    // 3. Filter out outer boundary / enclosing circle arcs, and edge-bleed fragments
    const minDim = Math.min(w, h);
    const nonCircleBlobs = blobs.filter((b) => {
      // Discard giant blobs that span most of the corner zone
      if (b.bbox.width >= zoneW * 0.70 && b.bbox.height >= zoneH * 0.70) return false;
      if (b.bbox.width >= w * 0.45 || b.bbox.height >= h * 0.45) return false;

      // Discard strokes whose global center is in the outer perimeter ring
      const globalCenterX = b.center.x + minX;
      const globalCenterY = b.center.y + minY;
      const distFromCenter = Math.hypot(globalCenterX - cx, globalCenterY - cy);
      if (distFromCenter >= minDim * 0.42) return false;

      // Discard strokes touching outer canvas borders when at a large radius
      const touchesOuterBorder =
        (def.corner === 'NW' && (b.bbox.x <= 8 || b.bbox.y <= 8)) ||
        (def.corner === 'NE' && (b.bbox.x + b.bbox.width >= zoneW - 8 || b.bbox.y <= 8)) ||
        (def.corner === 'SW' && (b.bbox.x <= 8 || b.bbox.y + b.bbox.height >= zoneH - 8)) ||
        (def.corner === 'SE' && (b.bbox.x + b.bbox.width >= zoneW - 8 || b.bbox.y + b.bbox.height >= zoneH - 8));
      if (touchesOuterBorder && distFromCenter >= minDim * 0.35) return false;

      return true;
    });
    if (nonCircleBlobs.length === 0) continue;

    const meanPixelCount = nonCircleBlobs.reduce((s, b) => s + b.pixelCount, 0) / nonCircleBlobs.length;
    const sizeThreshold = meanPixelCount * EDGE_BLEED_RATIO;

    const filtered = nonCircleBlobs.filter((blob) => {
      const touchesInner =
        (def.corner === 'NW' && (blob.bbox.x + blob.bbox.width >= zoneW - EDGE_MARGIN || blob.bbox.y + blob.bbox.height >= zoneH - EDGE_MARGIN)) ||
        (def.corner === 'NE' && (blob.bbox.x <= EDGE_MARGIN || blob.bbox.y + blob.bbox.height >= zoneH - EDGE_MARGIN)) ||
        (def.corner === 'SW' && (blob.bbox.x + blob.bbox.width >= zoneW - EDGE_MARGIN || blob.bbox.y <= EDGE_MARGIN)) ||
        (def.corner === 'SE' && (blob.bbox.x <= EDGE_MARGIN || blob.bbox.y <= EDGE_MARGIN));

      if (touchesInner && blob.pixelCount < sizeThreshold) return false;
      return true;
    });

    if (filtered.length === 0) continue;

    // 4. Map bbox coordinates back to global canvas coordinate space
    const offsetCrops: SegmentedCrop[] = filtered.map((blob) => ({
      ...blob,
      bbox: {
        x: blob.bbox.x + minX,
        y: blob.bbox.y + minY,
        width: blob.bbox.width,
        height: blob.bbox.height,
      },
      center: {
        x: blob.center.x + minX,
        y: blob.center.y + minY,
      },
    }));

    // 5. Label deduplication: reject blobs overlapping already claimed cardinal / effector components
    const deduped = offsetCrops.filter((crop) => {
      for (const ub of usedBBoxes) {
        if (
          crop.center.x >= ub.x - 5 &&
          crop.center.x <= ub.x + ub.width + 5 &&
          crop.center.y >= ub.y - 5 &&
          crop.center.y <= ub.y + ub.height + 5
        ) {
          return false;
        }
      }
      return true;
    });

    if (deduped.length === 0) continue;

    // 6. Sort by pixel count descending — dominant blob is the primary form sigil
    deduped.sort((a, b) => b.pixelCount - a.pixelCount);
    const dominant = deduped[0];
    forms[def.key] = [dominant];
    usedIndices.add(dominant.index);
    usedBBoxes.push(dominant.bbox);
  }

  return { forms, diagonalZones };
}

// ============================================================================
// SECTION 7: CANVAS CROPPING & EFFECTOR EXTRACTION UTILITIES
// ============================================================================

/**
 * Extracts a rectangular sub-region from a canvas into a new standalone canvas.
 *
 * @param source - Original source canvas
 * @param region - Left, right, top, bottom bounds in pixel coordinates
 * @param padding - Optional margin added around the cropped region (default: 8)
 * @returns Offscreen canvas containing the cropped region
 */
export function canvasCropFromRegion(
  source: HTMLCanvasElement,
  region: { left: number; right: number; top: number; bottom: number },
  padding = 8
): HTMLCanvasElement {
  const x = Math.max(0, Math.floor(region.left - padding));
  const y = Math.max(0, Math.floor(region.top - padding));
  const r = Math.min(source.width, Math.ceil(region.right + padding));
  const b = Math.min(source.height, Math.ceil(region.bottom + padding));

  const out = document.createElement('canvas');
  out.width = Math.max(1, r - x);
  out.height = Math.max(1, b - y);
  const ctx = out.getContext('2d');
  if (ctx) {
    ctx.drawImage(source, x, y, out.width, out.height, 0, 0, out.width, out.height);
  }
  return out;
}

/**
 * Composites multiple segmented components into a single clean canvas without
 * any background noise or intruding neighbor strokes.
 *
 * Each component is drawn strictly from its isolated component canvas rather
 * than slicing the global canvas, ensuring zero neighbor bleed.
 *
 * @param source - Source canvas reference (for fallback dimension checks)
 * @param components - Array of SegmentedCrop items to combine
 * @param padding - Outer margin around the combined bounding box (default: 8)
 * @returns Merged canvas containing all specified components, or null if empty
 */
export function canvasCropForComponents(
  source: HTMLCanvasElement,
  components: SegmentedCrop[],
  padding = 8
): HTMLCanvasElement | null {
  if (!components.length) return null;
  if (components.length === 1) {
    return components[0].canvas;
  }

  // Compute the tight bounding box across all components
  const minX = Math.min(...components.map((c) => c.bbox.x));
  const minY = Math.min(...components.map((c) => c.bbox.y));
  const maxX = Math.max(...components.map((c) => c.bbox.x + c.bbox.width));
  const maxY = Math.max(...components.map((c) => c.bbox.y + c.bbox.height));

  const tightW = maxX - minX;
  const tightH = maxY - minY;
  if (tightW <= 0 || tightH <= 0) return null;

  // Create a clean canvas and composite ONLY the isolated blob canvases (no source bleed)
  const canvas = document.createElement('canvas');
  canvas.width = tightW + padding * 2;
  canvas.height = tightH + padding * 2;
  const ctx = canvas.getContext('2d')!;

  const segPad = 12; // padding baked into each SegmentedCrop.canvas by segmentSymbols
  for (const c of components) {
    const dx = c.bbox.x - minX + padding;
    const dy = c.bbox.y - minY + padding;
    ctx.drawImage(
      c.canvas,
      segPad, segPad, c.bbox.width, c.bbox.height,
      dx, dy, c.bbox.width, c.bbox.height
    );
  }

  return canvas;
}

/**
 * Cleans a directional effector crop canvas by removing neighbor edge intrusions
 * and stray noise specks.
 *
 * @param directionalCanvas - Pre-cropped central canvas
 * @param padding - Padding around the cleaned components (default: 10)
 * @param dpr - Device pixel ratio (default: 1)
 * @returns Cleaned canvas, active components, and tight local bounding box
 */
export function extractCleanEffectorCrop(
  directionalCanvas: HTMLCanvasElement | null,
  padding = 10,
  dpr = 1
): { canvas: HTMLCanvasElement | null; mainComponents: SegmentedCrop[]; tightBBox?: BoundingBox } {
  if (!directionalCanvas || directionalCanvas.width <= 1 || directionalCanvas.height <= 1) {
    return { canvas: null, mainComponents: [] };
  }

  const dw = directionalCanvas.width;
  const dh = directionalCanvas.height;

  // Run connected component segmentation directly on the directional effector crop
  // We use a high gap tolerance so that central disconnected strokes merge into one component
  const scaledGapTol = Math.max(1, Math.round(8 * dpr));
  const components = segmentSymbols(directionalCanvas, {
    alphaThreshold: 20,
    outlierRatio: 0.2,
    absoluteFloorPixels: Math.round(20 * dpr * dpr),
    padding: 12,
    gapTolerance: scaledGapTol,
    dpr,
  });

  if (components.length === 0) {
    return { canvas: directionalCanvas, mainComponents: [] };
  }

  // 1. Identify which components are central vs intruding edge neighbors
  // Edge neighbors touch the boundary within an adaptive margin of the outer crop perimeter
  const edgeMargin = Math.max(3, Math.round(3 * dpr));
  const isEdgeNeighbor = (c: SegmentedCrop) => {
    const touchesEdge =
      c.bbox.x <= edgeMargin ||
      c.bbox.y <= edgeMargin ||
      c.bbox.x + c.bbox.width >= dw - edgeMargin ||
      c.bbox.y + c.bbox.height >= dh - edgeMargin;
    return touchesEdge;
  };

  const nonEdgeComponents = components.filter((c) => !isEdgeNeighbor(c));
  const candidateComponents = nonEdgeComponents.length > 0 ? nonEdgeComponents : components;

  // 2. Filter out tiny dots / noise specks — thresholds scale with DPR
  const noiseFloor = Math.round(35 * dpr * dpr);
  const sizeFloor = Math.round(10 * dpr);
  const pixFloor = Math.round(30 * dpr * dpr);
  const maxPix = Math.max(...candidateComponents.map((c) => c.pixelCount));
  const threshold = Math.max(noiseFloor, maxPix * 0.08);
  const mainComponents = candidateComponents.filter(
    (c) => c.pixelCount >= threshold || (c.bbox.width >= sizeFloor && c.bbox.height >= sizeFloor && c.pixelCount >= pixFloor)
  );

  const activeComponents = mainComponents.length > 0 ? mainComponents : candidateComponents;

  // 3. Compute tight local bounding box around the active central components
  const minX = Math.min(...activeComponents.map((c) => c.bbox.x));
  const minY = Math.min(...activeComponents.map((c) => c.bbox.y));
  const maxX = Math.max(...activeComponents.map((c) => c.bbox.x + c.bbox.width));
  const maxY = Math.max(...activeComponents.map((c) => c.bbox.y + c.bbox.height));

  const tightW = Math.max(1, maxX - minX);
  const tightH = Math.max(1, maxY - minY);

  // 4. Create a clean isolated canvas and render ONLY the masked pixels of the active components
  const cleanCanvas = document.createElement('canvas');
  cleanCanvas.width = tightW + padding * 2;
  cleanCanvas.height = tightH + padding * 2;
  const cctx = cleanCanvas.getContext('2d');

  if (cctx) {
    cctx.clearRect(0, 0, cleanCanvas.width, cleanCanvas.height);
    for (const comp of activeComponents) {
      const compPadding = 12; // SegmentedCrop internal padding
      const dx = comp.bbox.x - minX + padding;
      const dy = comp.bbox.y - minY + padding;
      cctx.drawImage(
        comp.canvas,
        compPadding,
        compPadding,
        comp.bbox.width,
        comp.bbox.height,
        dx,
        dy,
        comp.bbox.width,
        comp.bbox.height
      );
    }
  }

  return {
    canvas: cleanCanvas,
    mainComponents: activeComponents,
    tightBBox: { x: minX, y: minY, width: tightW, height: tightH }
  };
}

// ============================================================================
// SECTION 8: MACHINE LEARNING INFERENCE & CANONICAL CLASSIFICATION
// ============================================================================

/**
 * Options for configuring role-based candidate constraints during ML inference.
 */
export interface RecognizeCropOptions {
  /** The semantic role of the slot being recognized */
  role?: 'effector' | 'direction' | 'form';
  /** Explicit whitelist of class labels to evaluate */
  allowedClasses?: string[];
  /** Explicit blacklist of class labels to omit */
  excludedClasses?: string[];
}

/**
 * Performs machine learning inference on an isolated symbol crop canvas.
 *
 * Execution flow:
 * 1. Validates available canonical sigil definitions from `useAdminSigilsStore`.
 * 2. If role is 'direction', immediately resolves to the canonical 'Position' augmentor (95% confidence).
 * 3. Computes a 1280-dimensional MobileNet feature embedding of the drawing.
 * 4. Priority Tier 1: If trained custom neural network weights exist in `useTrainingStore`,
 *    runs forward prediction via `predictWithTrainedModel`.
 * 5. Priority Tier 2: If no trained weights exist, falls back to k-NN cosine exemplar classification
 *    using user-drawn samples stored in `training_store.examples`.
 * 6. Priority Tier 3: Provides safe defaults for initial untyped drawing states (e.g., 'Fire' for effector,
 *    'Dash' for form) before the user has recorded training samples.
 *
 * @param cropCanvas - Isolated canvas containing the symbol drawing
 * @param options - Role constraint configuration
 * @returns RecognitionItemResult with matched sigil ID, label, and confidence score
 */
export async function recognizeCropCanvas(
  cropCanvas: HTMLCanvasElement | null,
  options?: RecognizeCropOptions
): Promise<RecognitionItemResult> {
  if (!cropCanvas) {
    return { sigilId: null, label: null, confidence: null, available: false };
  }

  let sigils = useAdminSigilsStore.getState().sigils;
  if (!sigils || sigils.length === 0) {
    try {
      await useAdminSigilsStore.getState().loadRemoteSigils();
      sigils = useAdminSigilsStore.getState().sigils;
    } catch (fetchErr) {
      console.warn('Failed to load remote sigils on demand in recognizeCropCanvas:', fetchErr);
    }
  }

  if (!sigils || sigils.length === 0) {
    throw new Error('No sigils found in database. Please ensure sigils are created or synchronized from the database.');
  }

  // 1. Cardinal direction slots are intrinsically the Position augmentor
  if (options?.role === 'direction') {
    const posSigil = resolveCanonicalSigil('Position', sigils);
    return {
      sigilId: posSigil?.id || 'aug-position',
      label: 'Position',
      confidence: 0.95,
      available: true,
      confidences: { Position: 0.95 },
    };
  }

  let candidateSigils: typeof sigils = [];
  if (options?.role === 'effector') {
    candidateSigils = sigils.filter((s) => s.type === 'effector' || (s as any).sigilType === 'effector');
  } else if (options?.role === 'form') {
    candidateSigils = sigils.filter((s) => (s.type === 'augmentor' && (s.augmentorType === 'form' || 'formType' in s)) || (s as any).sigilType === 'form');
  }

  const { savedWeights, trainedClassLabels, examples } = useTrainingStore.getState();

  try {
    const embedding = await embedDrawing(cropCanvas);

    // 2. If trained neural network weights are active, run primary inference
    if (savedWeights && savedWeights.length > 0 && trainedClassLabels.length > 0) {
      let allowedClasses = options?.allowedClasses;
      const excludedClasses = options?.excludedClasses;

      let canPredict = true;
      if (!allowedClasses && options?.role && candidateSigils.length > 0) {
        const candidateIds = new Set(
          candidateSigils.flatMap((s) => [
            s.id,
            s.id.toLowerCase(),
            s.label,
            s.label.toLowerCase(),
            s.formType,
            s.formType?.toLowerCase(),
          ]).filter(Boolean)
        );
        const matchedTrained = trainedClassLabels.filter(
          (lbl) => candidateIds.has(lbl) || candidateIds.has(lbl.toLowerCase())
        );
        if (matchedTrained.length > 0) {
          allowedClasses = matchedTrained;
        } else {
          canPredict = false;
        }
      }

      if (canPredict) {
        const result = predictWithTrainedModel(embedding, savedWeights, trainedClassLabels, {
          allowedClasses,
          excludedClasses,
        });

        const resolved = resolveCanonicalSigil(result.label, sigils);
        return {
          sigilId: resolved?.id || result.label,
          label: resolved?.label || result.label,
          confidence: result.rawSimilarity >= 0 ? result.rawSimilarity : null,
          available: true,
          confidences: result.confidences,
        };
      }
    }

    // 3. If no weights trained, fallback to k-NN exemplar classification
    console.log(
      '[recognizeCropCanvas] Step 3 triggered (k-NN exemplar fallback).',
      'savedWeights count:', savedWeights?.length ?? 0,
      'trainedClassLabels:', trainedClassLabels,
      'role:', options?.role,
      'total raw examples in store:', Object.keys(examples).length
    );

    // Filter examples so only sigils matching the current slot role are evaluated
    let filteredExamples = examples;
    if (options?.role && candidateSigils.length > 0) {
      const allowedSigilIdentifiers = new Set(
        candidateSigils.flatMap((s) => [
          s.id,
          s.id.toLowerCase(),
          s.label,
          s.label.toLowerCase(),
          s.formType,
          s.formType?.toLowerCase(),
        ]).filter(Boolean)
      );

      filteredExamples = {};
      for (const [key, val] of Object.entries(examples)) {
        if (allowedSigilIdentifiers.has(key) || allowedSigilIdentifiers.has(key.toLowerCase())) {
          filteredExamples[key] = val;
        }
      }
    }

    const hasExamples = Object.values(filteredExamples).some((ex) => ex.length > 0);
    if (hasExamples) {
      const result = classifyEmbedding(embedding, filteredExamples);
      const resolved = resolveCanonicalSigil(result.label, sigils);
      return {
        sigilId: resolved?.id || result.label,
        label: resolved?.label || result.label,
        confidence: result.rawSimilarity >= 0 ? result.rawSimilarity : null,
        available: true,
        confidences: result.confidences,
      };
    }

    // 4. Default classification when user draws before training
    if (options?.role === 'effector') {
      const defaultEffector = resolveCanonicalSigil('Fire', candidateSigils) || candidateSigils[0];
      if (defaultEffector) {
        return {
          sigilId: defaultEffector.id,
          label: defaultEffector.label,
          confidence: 0.85,
          available: true,
          confidences: { [defaultEffector.label]: 0.85 },
        };
      }
      throw new Error('No effector sigils found in database.');
    }

    if (options?.role === 'form') {
      const defaultForm = resolveCanonicalSigil('Dash', candidateSigils) || candidateSigils[0];
      if (defaultForm) {
        return {
          sigilId: defaultForm.id,
          label: defaultForm.label,
          confidence: 0.85,
          available: true,
          confidences: { [defaultForm.label]: 0.85 },
        };
      }
      throw new Error('No form augmentor sigils found in database.');
    }

    return { sigilId: null, label: null, confidence: null, available: false };
  } catch (err) {
    if (err instanceof Error && err.message.includes('No sigils found in database')) {
      throw err;
    }
    console.warn('Inference error for crop:', err);
    return { sigilId: null, label: null, confidence: null, available: false };
  }
}

// ============================================================================
// SECTION 9: MASTER COMPOSITION PIPELINE ORCHESTRATION
// ============================================================================

/**
 * Executes the complete end-to-end glyph composition analysis pipeline.
 *
 * Full Pipeline Workflow:
 * -----------------------
 * 1. Database Check:
 *    Ensures canonical sigil metadata is loaded from `useAdminSigilsStore`.
 *
 * 2. Segmentation:
 *    Executes DPR-aware connected-component segmentation on the full source canvas
 *    to isolate all hand-drawn strokes into `rawCrops`.
 *
 * 3. Spatial Slot Classification:
 *    Classifies cardinal direction slots (top, right, bottom, left) and computes
 *    the central effector search region bounded by the cardinal tips.
 *
 * 4. Enclosing Circle Isolation & Inner Canvas Preparation:
 *    Identifies enclosing circle strokes and cleanly erases them on an `innerCanvas`
 *    via `globalCompositeOperation = 'destination-out'`.
 *
 * 5. Diagonal Form Augmentor Detection:
 *    Searches the NW, NE, SW, and SE quadrants on `innerCanvas` for form augmentors,
 *    guaranteeing that no enclosing circle arcs are misclassified.
 *
 * 6. Central Effector Extraction:
 *    Extracts the central components bounded by the cardinal anchors, builds a
 *    clean isolated canvas crop, and evaluates initial ML recognition.
 *
 * 7. Failsafe Multi-Component Effector Combination Search:
 *    If initial effector confidence is < 20% (< 0.20):
 *    - Gathers up to the 4 closest interior symbols strictly within the cardinal
 *      searchbox (never touching cardinal arrows or form augmentors).
 *    - Generates all 2^N - 1 non-empty subsets (up to 15 combinations).
 *    - Evaluates each combination through ML inference.
 *    - If a combination exceeds the initial confidence, adopts it as the effector.
 *
 * 8. Semantic Assembly:
 *    Constructs the final dictionary of semantic crops and returns metrics summary.
 *
 * @param sourceCanvas - The input canvas containing the full drawn glyph
 * @returns GlyphCompositionAnalysis with all slots, crops, and ML classifications
 */
export async function analyzeGlyphComposition(sourceCanvas: HTMLCanvasElement): Promise<GlyphCompositionAnalysis> {
  let sigils = useAdminSigilsStore.getState().sigils;
  if (!sigils || sigils.length === 0) {
    try {
      await useAdminSigilsStore.getState().loadRemoteSigils();
      sigils = useAdminSigilsStore.getState().sigils;
    } catch (fetchErr) {
      console.warn('Failed to load remote sigils on demand in analyzeGlyphComposition:', fetchErr);
    }
  }

  if (!sigils || sigils.length === 0) {
    throw new Error('No sigils found in database. Please ensure sigils are created or synchronized from the database.');
  }
  const dpr = getCanvasDpr(sourceCanvas);
  const rawCrops = segmentSymbols(sourceCanvas, {
    alphaThreshold: 20,
    outlierRatio: 0.35,
    padding: 12,
    dpr,
  });

  const spatial = classifyGlyphSpatialSlots(rawCrops, sourceCanvas.width, sourceCanvas.height);

  const cx = spatial.center?.x ?? sourceCanvas.width / 2;
  const cy = spatial.center?.y ?? sourceCanvas.height / 2;
  const enclosingCircleCrops = rawCrops.filter((c) =>
    isEnclosingCircleCandidate(c, sourceCanvas.width, sourceCanvas.height, cx, cy)
  );

  // Prepare an inner canvas where outer enclosing circle strokes are cleanly erased,
  // guaranteeing that no enclosing circle arcs are picked up in diagonal corner detection
  const innerCanvas = document.createElement('canvas');
  innerCanvas.width = sourceCanvas.width;
  innerCanvas.height = sourceCanvas.height;
  const innerCtx = innerCanvas.getContext('2d')!;
  innerCtx.drawImage(sourceCanvas, 0, 0);

  if (enclosingCircleCrops.length > 0) {
    innerCtx.save();
    innerCtx.globalCompositeOperation = 'destination-out';
    const segPad = 12; // SegmentedCrop padding baked in by segmentSymbols
    for (const ec of enclosingCircleCrops) {
      innerCtx.drawImage(
        ec.canvas,
        segPad, segPad, ec.bbox.width, ec.bbox.height,
        ec.bbox.x, ec.bbox.y, ec.bbox.width, ec.bbox.height
      );
    }
    innerCtx.restore();
  }

  const d = spatial.directions;

  // Build sets of claimed symbol indices for cardinal directions
  const usedCardinalIndices = new Set(
    Object.values(d).filter(Boolean).map((c) => (c as SegmentedCrop).index)
  );

  // Helper to test if a stroke center is genuinely within the central effector zone,
  // preventing diagonal corner marks from being swallowed into the effector.
  const inCentralEffectorZone = (c: SegmentedCrop) => {
    if (c.center.x < spatial.region.left || c.center.x > spatial.region.right) return false;
    if (c.center.y < spatial.region.top || c.center.y > spatial.region.bottom) return false;
    const dx = c.center.x - cx;
    const dy = c.center.y - cy;
    const spanX = dx >= 0 ? Math.max(10, spatial.region.right - cx) : Math.max(10, cx - spatial.region.left);
    const spanY = dy >= 0 ? Math.max(10, spatial.region.bottom - cy) : Math.max(10, cy - spatial.region.top);
    const normDistSq = (dx / spanX) * (dx / spanX) + (dy / spanY) * (dy / spanY);
    // Cardinal tips are at normDistSq = 1.0; outer diagonal corners are at normDistSq = 2.0
    // 1.15 cuts off the diagonal corner marks while allowing full reach to cardinal tips
    return normDistSq <= 1.15;
  };

  // 1. Isolate the central effector components strictly within the cardinal searchbox (spatial.region)
  // Effector symbols must NOT be cardinals, must NOT be enclosing circles,
  // and must lie strictly within the central effector zone.
  const candidateEffectorCrops = rawCrops.filter(
    (c) =>
      !usedCardinalIndices.has(c.index) &&
      !isEnclosingCircleCandidate(c, sourceCanvas.width, sourceCanvas.height, cx, cy) &&
      inCentralEffectorZone(c) &&
      c.bbox.width < sourceCanvas.width * 0.55 &&
      c.bbox.height < sourceCanvas.height * 0.55
  );

  let activeEffectorComponents: SegmentedCrop[] = candidateEffectorCrops;
  let activeEffectorCrop: HTMLCanvasElement | null = null;
  let activeEffectorBBox: BoundingBox | undefined = undefined;

  if (activeEffectorComponents.length > 0) {
    activeEffectorCrop = canvasCropForComponents(sourceCanvas, activeEffectorComponents, 12);
    const minX = Math.min(...activeEffectorComponents.map((c) => c.bbox.x));
    const minY = Math.min(...activeEffectorComponents.map((c) => c.bbox.y));
    const maxX = Math.max(...activeEffectorComponents.map((c) => c.bbox.x + c.bbox.width));
    const maxY = Math.max(...activeEffectorComponents.map((c) => c.bbox.y + c.bbox.height));
    activeEffectorBBox = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    spatial.effectorComponents = activeEffectorComponents;
  } else {
    // If no component was strictly inside the initial box, pick the closest central mark
    const centerPool = rawCrops.filter(
      (c) =>
        !usedCardinalIndices.has(c.index) &&
        !isEnclosingCircleCandidate(c, sourceCanvas.width, sourceCanvas.height, cx, cy) &&
        c.bbox.width < sourceCanvas.width * 0.55 &&
        c.bbox.height < sourceCanvas.height * 0.55 &&
        Math.hypot(c.center.x - cx, c.center.y - cy) <= Math.min(sourceCanvas.width, sourceCanvas.height) * 0.25
    );
    if (centerPool.length > 0) {
      centerPool.sort(
        (a, b) =>
          Math.hypot(a.center.x - cx, a.center.y - cy) -
          Math.hypot(b.center.x - cx, b.center.y - cy)
      );
      activeEffectorComponents = [centerPool[0]];
      activeEffectorCrop = canvasCropForComponents(sourceCanvas, activeEffectorComponents, 12);
      activeEffectorBBox = { ...centerPool[0].bbox };
      spatial.effectorComponents = activeEffectorComponents;
    }
  }

  // Initial recognition for central effector
  let effectorRecognition = await recognizeCropCanvas(activeEffectorCrop, { role: 'effector' });
  const initialEffectorConf = effectorRecognition.confidence ?? 0;

  // Fail-safe: If effector recognition confidence is lower than 20% (< 0.20),
  // grab the four closest symbols to the detected effector and test their
  // combinations to find the combo with the highest confidence / accuracy.
  if (initialEffectorConf < 0.20) {
    console.log(
      `[Effector Failsafe] Triggered: Initial confidence ${(initialEffectorConf * 100).toFixed(1)}% is < 20% (${effectorRecognition.label || 'None'}). Searching combinations...`
    );

    // Measure distance from the center of the bounding box of the current detected effector sigil
    const effCenter = activeEffectorBBox
      ? {
        x: activeEffectorBBox.x + activeEffectorBBox.width / 2,
        y: activeEffectorBBox.y + activeEffectorBBox.height / 2,
      }
      : spatial.center;

    // Available symbols strictly within the central effector zone (never cardinals or circles)
    const availableCrops = rawCrops.filter(
      (c) =>
        !isEnclosingCircleCandidate(c, sourceCanvas.width, sourceCanvas.height, effCenter.x, effCenter.y) &&
        !usedCardinalIndices.has(c.index) &&
        inCentralEffectorZone(c) &&
        c.pixelCount >= Math.round(25 * dpr * dpr) &&
        c.bbox.width < sourceCanvas.width * 0.55 &&
        c.bbox.height < sourceCanvas.height * 0.55
    );

    // Sort available symbols by distance from detected effector center ascending
    availableCrops.sort((a, b) => {
      const distA = Math.hypot(a.center.x - effCenter.x, a.center.y - effCenter.y);
      const distB = Math.hypot(b.center.x - effCenter.x, b.center.y - effCenter.y);
      return distA - distB;
    });

    const closestFour = availableCrops.slice(0, 4);
    console.log(
      `[Effector Failsafe] Closest symbols near center:`,
      closestFour.map((c) => `[#${c.index} at (${Math.round(c.center.x)},${Math.round(c.center.y)}) w:${c.bbox.width} h:${c.bbox.height}]`)
    );

    if (closestFour.length > 0) {
      // Helper to generate all non-empty combinations of an array (2^N - 1)
      const getAllSubsets = <T>(arr: T[]): T[][] => {
        const subsets: T[][] = [];
        const total = 1 << arr.length;
        for (let i = 1; i < total; i++) {
          const sub: T[] = [];
          for (let j = 0; j < arr.length; j++) {
            if ((i >> j) & 1) {
              sub.push(arr[j]);
            }
          }
          subsets.push(sub);
        }
        return subsets;
      };

      const subsets = getAllSubsets(closestFour);
      let bestConf = initialEffectorConf;
      let bestRec = effectorRecognition;
      let bestCanvas = activeEffectorCrop;
      let bestComponents = activeEffectorComponents;
      let bestBBox = activeEffectorBBox;

      for (const combo of subsets) {
        if (combo.length === 0) continue;
        const comboCanvas = canvasCropForComponents(sourceCanvas, combo, 12);
        if (!comboCanvas) continue;

        const comboRec = await recognizeCropCanvas(comboCanvas, { role: 'effector' });
        const conf = comboRec.confidence ?? 0;
        console.log(
          `[Effector Failsafe] Tested combo [${combo.map((c) => c.index).join(',')}]: ${comboRec.label} -> ${(conf * 100).toFixed(1)}%`
        );

        if (conf > bestConf) {
          bestConf = conf;
          bestRec = comboRec;
          bestCanvas = comboCanvas;
          bestComponents = combo;

          const minX = Math.min(...combo.map((c) => c.bbox.x));
          const minY = Math.min(...combo.map((c) => c.bbox.y));
          const maxX = Math.max(...combo.map((c) => c.bbox.x + c.bbox.width));
          const maxY = Math.max(...combo.map((c) => c.bbox.y + c.bbox.height));
          bestBBox = {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY,
          };
        }
      }

      // If a higher confidence combination was found, adopt it
      if (bestConf > initialEffectorConf) {
        console.log(
          `[Effector Failsafe] Adopted superior combination: ${bestRec.label} with ${(bestConf * 100).toFixed(1)}% (was ${(initialEffectorConf * 100).toFixed(1)}%)`
        );
        activeEffectorCrop = bestCanvas;
        activeEffectorComponents = bestComponents;
        activeEffectorBBox = bestBBox;
        effectorRecognition = bestRec;
        spatial.effectorComponents = bestComponents;

        // Clean up any absorbed symbols from direction slots so they aren't double-claimed
        const absorbedIndices = new Set(bestComponents.map((c) => c.index));
        for (const [slotKey, crop] of Object.entries(d) as [keyof typeof d, SegmentedCrop | undefined][]) {
          if (crop && absorbedIndices.has(crop.index)) {
            delete d[slotKey];
          }
        }
      } else {
        console.log(
          `[Effector Failsafe] None of the 15 tested combinations exceeded initial ${(initialEffectorConf * 100).toFixed(1)}%. Keeping original.`
        );
      }
    }
  }

  // 2. NOW run zone-based diagonal detection for form augmentors strictly on innerCanvas.
  // This uses the bounding boxes of the positional anchors AND the resolved central effector,
  // guaranteeing that the diagonal search zones stop at the effector and never claim effector strokes!
  const { forms, diagonalZones } = detectCornerFormZones(innerCanvas, spatial, dpr);
  spatial.forms = forms;
  spatial.diagonalZones = diagonalZones;

  const f = spatial.forms;

  const cropMap: Record<
    string,
    { title: string; role: 'effector' | 'direction' | 'form'; canvas: HTMLCanvasElement | null; count: number }
  > = {
    effector: {
      title: 'Effector (Center)',
      role: 'effector',
      canvas: activeEffectorCrop,
      count: activeEffectorComponents.length,
    },
    top: { title: 'Top Direction (↑)', role: 'direction', canvas: d.top?.canvas || null, count: d.top ? 1 : 0 },
    right: { title: 'Right Direction (→)', role: 'direction', canvas: d.right?.canvas || null, count: d.right ? 1 : 0 },
    bottom: {
      title: 'Bottom Direction (↓)',
      role: 'direction',
      canvas: d.bottom?.canvas || null,
      count: d.bottom ? 1 : 0,
    },
    left: { title: 'Left Direction (←)', role: 'direction', canvas: d.left?.canvas || null, count: d.left ? 1 : 0 },
    topLeft: {
      title: 'Top-Left Form (↖)',
      role: 'form',
      canvas: canvasCropForComponents(sourceCanvas, f.topLeft, 8),
      count: f.topLeft.length,
    },
    topRight: {
      title: 'Top-Right Form (↗)',
      role: 'form',
      canvas: canvasCropForComponents(sourceCanvas, f.topRight, 8),
      count: f.topRight.length,
    },
    bottomLeft: {
      title: 'Bottom-Left Form (↙)',
      role: 'form',
      canvas: canvasCropForComponents(sourceCanvas, f.bottomLeft, 8),
      count: f.bottomLeft.length,
    },
    bottomRight: {
      title: 'Bottom-Right Form (↘)',
      role: 'form',
      canvas: canvasCropForComponents(sourceCanvas, f.bottomRight, 8),
      count: f.bottomRight.length,
    },
  };

  const semanticCrops: Record<string, SemanticCropItem> = {};

  for (const [key, item] of Object.entries(cropMap)) {
    const recognition =
      key === 'effector' ? effectorRecognition : await recognizeCropCanvas(item.canvas, { role: item.role });
    semanticCrops[key] = {
      key,
      title: item.title,
      role: item.role,
      canvas: item.canvas,
      dataUrl: item.canvas ? item.canvas.toDataURL('image/png') : null,
      componentCount: item.count,
      recognition,
    };
  }

  const directionsCount = (d.top ? 1 : 0) + (d.right ? 1 : 0) + (d.bottom ? 1 : 0) + (d.left ? 1 : 0);
  const formsCount = f.topLeft.length + f.topRight.length + f.bottomLeft.length + f.bottomRight.length;

  return {
    rawCrops,
    spatial,
    effectorCrop: activeEffectorCrop,
    effectorBBox: activeEffectorBBox,
    diagonalZones,
    semanticCrops,
    summary: {
      effectorCount: spatial.effectorComponents.length,
      directionsCount,
      formsCount,
      totalComponents: rawCrops.length,
    },
  };
}
