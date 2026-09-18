import * as tf from '@tensorflow/tfjs';
import { getOrLoadEmbeddingModel, toModelInput, embedDrawing, classifyEmbedding } from './embedding_engine';
import { useTrainingStore } from './training_store';
import { useAdminSigilsStore } from '../stores/admin_sigils_store';
import { predictWithTrainedModel } from './model_trainer';
import { resolveCanonicalSigil } from '../glyph_helpers/sigils';

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface SegmentedCrop {
  canvas: HTMLCanvasElement;
  dataUrl: string;
  pixelCount: number;
  index: number;
  bbox: BoundingBox;
  center: Point;
}

export interface DirectionSlots {
  top?: SegmentedCrop;
  right?: SegmentedCrop;
  bottom?: SegmentedCrop;
  left?: SegmentedCrop;
}

export interface FormSlots {
  topLeft: SegmentedCrop[];
  topRight: SegmentedCrop[];
  bottomLeft: SegmentedCrop[];
  bottomRight: SegmentedCrop[];
}

export interface SpatialAnalysisResult {
  center: Point;
  directions: DirectionSlots;
  region: { left: number; right: number; top: number; bottom: number };
  effectorComponents: SegmentedCrop[];
  forms: FormSlots;
  items: (SegmentedCrop & { cx: number; cy: number; dx: number; dy: number; angle: number; dist: number })[];
}

export interface RecognitionItemResult {
  sigilId?: string | null;
  label: string | null;
  confidence: number | null;
  available: boolean;
  confidences?: Record<string, number>;
}

export interface SemanticCropItem {
  key: string;
  title: string;
  role: 'effector' | 'direction' | 'form';
  canvas: HTMLCanvasElement | null;
  dataUrl: string | null;
  componentCount: number;
  recognition: RecognitionItemResult;
}

export interface GlyphCompositionAnalysis {
  rawCrops: SegmentedCrop[];
  spatial: SpatialAnalysisResult;
  effectorCrop: HTMLCanvasElement | null;
  effectorBBox?: BoundingBox;
  semanticCrops: Record<string, SemanticCropItem>;
  summary: {
    effectorCount: number;
    directionsCount: number;
    formsCount: number;
    totalComponents: number;
  };
}

/**
 * Connected-Component Segmentation using 4-connectivity flood fill
 */
export function segmentSymbols(
  sourceCanvas: HTMLCanvasElement,
  opts: {
    alphaThreshold?: number;
    outlierRatio?: number;
    minBlobsForMeanFilter?: number;
    absoluteFloorPixels?: number;
    padding?: number;
    gapTolerance?: number;
  } = {}
): SegmentedCrop[] {
  const {
    alphaThreshold = 20,
    outlierRatio = 0.35,
    minBlobsForMeanFilter = 2,
    absoluteFloorPixels = 35,
    padding = 12,
    gapTolerance = 1,
  } = opts;

  const w = sourceCanvas.width;
  const h = sourceCanvas.height;
  if (!w || !h) return [];

  const ctx = sourceCanvas.getContext('2d');
  if (!ctx) return [];

  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

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

      while (sp > 0) {
        const cur = stack[--sp];
        const cx = cur % w;
        const cy = (cur / w) | 0;
        pixelCount++;

        if (cx < minX) minX = cx;
        if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy;
        if (cy > maxY) maxY = cy;

        // Gap-tolerant connectivity
        const R = gapTolerance;
        const R2 = R * R;
        const startX = Math.max(0, cx - R);
        const endX = Math.min(w - 1, cx + R);
        const startY = Math.max(0, cy - R);
        const endY = Math.min(h - 1, cy + R);

        for (let ny = startY; ny <= endY; ny++) {
          for (let nx = startX; nx <= endX; nx++) {
            const n = ny * w + nx;
            // Fast reject before expensive math
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

  // Filter out noise marks
  let blobs: RawBlob[];
  if (allBlobs.length >= minBlobsForMeanFilter) {
    const meanPixelCount = allBlobs.reduce((sum, b) => sum + b.pixelCount, 0) / allBlobs.length;
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

function angleDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % (Math.PI * 2);
  return d > Math.PI ? Math.PI * 2 - d : d;
}

/**
 * Classify components into Cardinal Directions, Central Effector, and Diagonal Form Augmentors
 */
export function classifyGlyphSpatialSlots(crops: SegmentedCrop[], w: number, h: number): SpatialAnalysisResult {
  // Dynamically compute center from bounding box union of all drawn components
  let center: Point = { x: w / 2, y: h / 2 };
  let glyphSpan = Math.min(w, h);

  if (crops.length > 0) {
    const minX = Math.min(...crops.map((c) => c.bbox.x));
    const maxX = Math.max(...crops.map((c) => c.bbox.x + c.bbox.width));
    const minY = Math.min(...crops.map((c) => c.bbox.y));
    const maxY = Math.max(...crops.map((c) => c.bbox.y + c.bbox.height));

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

  // Cardinal targets: right=0, bottom=PI/2, left=PI, top=-PI/2
  const target: Record<'right' | 'bottom' | 'left' | 'top', number> = {
    right: 0,
    bottom: Math.PI / 2,
    left: Math.PI,
    top: -Math.PI / 2,
  };

  const directions: DirectionSlots = {};
  const used = new Set<number>();
  const minCardinalDist = Math.max(20, Math.min(w, h) * 0.14, glyphSpan * 0.15);

  for (const [slot, a] of Object.entries(target) as [keyof typeof target, number][]) {
    const ranked = items
      .filter((x) => !used.has(x.index) && x.dist > minCardinalDist)
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

  // Inner boundaries of Cardinal Anchors determine the Effector region (with generous margins)
  // When cardinal anchors are absent, fall back to margins proportional to the glyph's dynamic center & span
  const fallbackHalfSpan = Math.max(25, glyphSpan * 0.32);
  const left = directions.left
    ? Math.max(0, directions.left.bbox.x + directions.left.bbox.width - 4)
    : Math.max(0, center.x - fallbackHalfSpan);
  const right = directions.right
    ? Math.min(w, directions.right.bbox.x + 4)
    : Math.min(w, center.x + fallbackHalfSpan);
  const top = directions.top
    ? Math.max(0, directions.top.bbox.y + directions.top.bbox.height - 4)
    : Math.max(0, center.y - fallbackHalfSpan);
  const bottom = directions.bottom
    ? Math.min(h, directions.bottom.bbox.y + 4)
    : Math.min(h, center.y + fallbackHalfSpan);
  const region = { left, right, top, bottom };

  const insideEffector = items.filter(
    (x) => !used.has(x.index) && x.cx >= left && x.cx <= right && x.cy >= top && x.cy <= bottom
  );
  insideEffector.forEach((x) => used.add(x.index));

  const remaining = items.filter((x) => !used.has(x.index));
  const forms: FormSlots = {
    topLeft: [],
    topRight: [],
    bottomLeft: [],
    bottomRight: [],
  };

  for (const x of remaining) {
    const horizontal = x.cx < center.x ? 'Left' : 'Right';
    const vertical = x.cy < center.y ? 'top' : 'bottom';
    const key = `${vertical}${horizontal}` as keyof FormSlots;
    if (forms[key]) {
      forms[key].push(x);
    }
  }

  return { center, directions, region, effectorComponents: insideEffector, forms, items };
}

/**
 * Direct Canvas Crop from original canvas without stitching
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
 * Takes the pre-cropped directional effector image (bounded by the directional arrows)
 * and isolates the true central symbols while completely removing:
 * 1. Intruding perimeter edge cuts from neighbor directional/augmentor marks.
 * 2. Stray micro-dots and noise specks.
 */
export function extractCleanEffectorCrop(
  directionalCanvas: HTMLCanvasElement | null,
  padding = 10
): { canvas: HTMLCanvasElement | null; mainComponents: SegmentedCrop[]; tightBBox?: BoundingBox } {
  if (!directionalCanvas || directionalCanvas.width <= 1 || directionalCanvas.height <= 1) {
    return { canvas: null, mainComponents: [] };
  }

  const dw = directionalCanvas.width;
  const dh = directionalCanvas.height;

  // Run connected component segmentation directly on the directional effector crop
  // We use a high gap tolerance (8px) here so that all central disconnected strokes merge into ONE solid component
  const components = segmentSymbols(directionalCanvas, {
    alphaThreshold: 20,
    outlierRatio: 0.2,
    absoluteFloorPixels: 20,
    padding: 12,
    gapTolerance: 8,
  });

  if (components.length === 0) {
    return { canvas: directionalCanvas, mainComponents: [] };
  }

  // 1. Identify which components are central vs intruding edge neighbors
  // Edge neighbors touch the boundary within 3px of the outer crop perimeter
  const isEdgeNeighbor = (c: SegmentedCrop) => {
    const touchesEdge =
      c.bbox.x <= 3 ||
      c.bbox.y <= 3 ||
      c.bbox.x + c.bbox.width >= dw - 3 ||
      c.bbox.y + c.bbox.height >= dh - 3;
    return touchesEdge;
  };

  const nonEdgeComponents = components.filter((c) => !isEdgeNeighbor(c));
  const candidateComponents = nonEdgeComponents.length > 0 ? nonEdgeComponents : components;

  // 2. Filter out tiny dots / noise specks (less than 35px or < 8% of max component size)
  const maxPix = Math.max(...candidateComponents.map((c) => c.pixelCount));
  const threshold = Math.max(35, maxPix * 0.08);
  const mainComponents = candidateComponents.filter(
    (c) => c.pixelCount >= threshold || (c.bbox.width >= 10 && c.bbox.height >= 10 && c.pixelCount >= 30)
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
  // (Zero background marks, zero neighbor edge penetration!)
  const cleanCanvas = document.createElement('canvas');
  cleanCanvas.width = tightW + padding * 2;
  cleanCanvas.height = tightH + padding * 2;
  const cctx = cleanCanvas.getContext('2d');

  if (cctx) {
    cctx.clearRect(0, 0, cleanCanvas.width, cleanCanvas.height);
    for (const comp of activeComponents) {
      // comp.canvas has 12px internal padding
      const compPadding = 12;
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

export interface RecognizeCropOptions {
  role?: 'effector' | 'direction' | 'form';
  allowedClasses?: string[];
  excludedClasses?: string[];
}

/**
 * ML Inference for a single crop canvas with optional role-based class filtering
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
    candidateSigils = sigils.filter((s) => s.type === 'effector');
  } else if (options?.role === 'form') {
    candidateSigils = sigils.filter((s) => s.type === 'augmentor' && (s.augmentorType === 'form' || 'formType' in s));
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
            (s as any).formType,
            (s as any).formType?.toLowerCase(),
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
          (s as any).formType,
          (s as any).formType?.toLowerCase(),
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

/**
 * End-to-end Glyph Composition Analysis
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
  const rawCrops = segmentSymbols(sourceCanvas, {
    alphaThreshold: 20,
    outlierRatio: 0.35,
    padding: 12,
  });

  const spatial = classifyGlyphSpatialSlots(rawCrops, sourceCanvas.width, sourceCanvas.height);

  // 1. Directly crop central effector bounded by the directional arrows (with generous padding)
  const directionalEffectorCrop =
    spatial.effectorComponents.length > 0 ? canvasCropFromRegion(sourceCanvas, spatial.region, 16) : null;

  // 2. Run multi-symbol detection directly on the cropped region to isolate main symbols and trim stray dots
  const { canvas: effectorCrop, mainComponents: effectorMainComponents, tightBBox } = extractCleanEffectorCrop(
    directionalEffectorCrop,
    12
  );

  let absoluteEffectorBBox: BoundingBox | undefined = undefined;
  if (tightBBox) {
    absoluteEffectorBBox = {
      x: Math.max(0, spatial.region.left - 16) + tightBBox.x,
      y: Math.max(0, spatial.region.top - 16) + tightBBox.y,
      width: tightBBox.width,
      height: tightBBox.height
    };
  }

  const d = spatial.directions;
  const f = spatial.forms;

  const cropMap: Record<
    string,
    { title: string; role: 'effector' | 'direction' | 'form'; canvas: HTMLCanvasElement | null; count: number }
  > = {
    effector: {
      title: 'Effector (Center)',
      role: 'effector',
      canvas: effectorCrop,
      count: effectorMainComponents.length,
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
    const recognition = await recognizeCropCanvas(item.canvas, { role: item.role });
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
    effectorCrop,
    effectorBBox: absoluteEffectorBBox,
    semanticCrops,
    summary: {
      effectorCount: spatial.effectorComponents.length,
      directionsCount,
      formsCount,
      totalComponents: rawCrops.length,
    },
  };
}
