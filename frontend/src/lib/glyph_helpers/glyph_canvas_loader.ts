/**
 * @file glyph_canvas_loader.ts
 * @description Helper functions to load saved glyphs into the DrawingCanvas pad.
 * Supports replaying saved vector StrokeData or rendering compositional slot
 * formations (outer boundary circle, effector, directional anchors, form augmentors).
 *
 * All rendering uses pure Atrament StrokeData — no ctx.drawImage — so every mark
 * is tracked by Atrament and the canvas remains recognisable to the ML analysis.
 */

import type { StrokeData, StrokePoint } from 'atrament';
import type { DrawingCanvasRef } from '../../components/DrawingCanvas';
import type { WorkshopGlyphItem, GlyphComposition } from '../../types/glyph_types';
import type { AdminGlyphItem } from '../stores/admin_glyphs_store';

// ---------------------------------------------------------------------------
// Stroke generators
// ---------------------------------------------------------------------------

function interpolateLineSegments(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  t0: number,
  steps = 14
): StrokePoint[] {
  const pts: StrokePoint[] = [];
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    pts.push({
      point: {
        x: Math.round(x1 + (x2 - x1) * f),
        y: Math.round(y1 + (y2 - y1) * f),
      },
      pressure: 0.9,
      time: t0 + i * 4,
    });
  }
  return pts;
}

/**
 * Generates synthetic Atrament StrokeData for a circular boundary ring.
 */
export function generateCircleStroke(
  cx: number,
  cy: number,
  radius: number,
  options?: { color?: string; weight?: number; segmentsCount?: number }
): StrokeData {
  const color = options?.color ?? '#2c2522';
  const weight = options?.weight ?? 4;
  const segmentsCount = options?.segmentsCount ?? 96;

  const segments: StrokePoint[] = [];
  const t0 = Date.now();

  for (let i = 0; i <= segmentsCount; i++) {
    const angle = (i / segmentsCount) * Math.PI * 2;
    segments.push({
      point: {
        x: Math.round(cx + radius * Math.cos(angle)),
        y: Math.round(cy + radius * Math.sin(angle)),
      },
      pressure: 0.88,
      time: t0 + i * 4,
    });
  }

  return { mode: 'draw', weight, color, smoothing: 0.2, adaptiveStroke: false, segments };
}

/**
 * Generates two crossed diagonal strokes ("X") for a form-augmentor slot marker.
 */
function generateXMarkerStrokes(
  cx: number,
  cy: number,
  size: number,
  color: string,
  weight: number,
  t: number
): StrokeData[] {
  const h = size / 2;
  return [
    {
      mode: 'draw',
      weight,
      color,
      smoothing: 0.1,
      adaptiveStroke: false,
      segments: interpolateLineSegments(cx - h, cy - h, cx + h, cy + h, t, 16),
    },
    {
      mode: 'draw',
      weight,
      color,
      smoothing: 0.1,
      adaptiveStroke: false,
      segments: interpolateLineSegments(cx + h, cy - h, cx - h, cy + h, t + 50, 16),
    },
  ];
}

/**
 * Generates a diamond outline stroke for a cardinal position-augmentor slot.
 */
function generateDiamondStroke(
  cx: number,
  cy: number,
  size: number,
  color: string,
  weight: number,
  t: number
): StrokeData {
  const h = size / 2;
  const corners = [
    { x: cx, y: cy - h },
    { x: cx + h, y: cy },
    { x: cx, y: cy + h },
    { x: cx - h, y: cy },
    { x: cx, y: cy - h }, // close
  ];
  const pts: StrokePoint[] = [];
  let curT = t;
  for (let i = 0; i < corners.length - 1; i++) {
    const p1 = corners[i];
    const p2 = corners[i + 1];
    pts.push(...interpolateLineSegments(p1.x, p1.y, p2.x, p2.y, curT, 10));
    curT += 45;
  }
  return {
    mode: 'draw',
    weight,
    color,
    smoothing: 0.1,
    adaptiveStroke: false,
    segments: pts,
  };
}

/**
 * Generates a small circle stroke for the center effector slot.
 */
function generateSmallCircleStroke(
  cx: number,
  cy: number,
  radius: number,
  color: string,
  weight: number,
  t: number,
  segs = 48
): StrokeData {
  const pts: StrokePoint[] = [];
  for (let i = 0; i <= segs; i++) {
    const angle = (i / segs) * Math.PI * 2;
    pts.push({
      point: {
        x: Math.round(cx + radius * Math.cos(angle)),
        y: Math.round(cy + radius * Math.sin(angle)),
      },
      pressure: 0.9,
      time: t + i * 4,
    });
  }
  return { mode: 'draw', weight, color, smoothing: 0.2, adaptiveStroke: false, segments: pts };
}

// ---------------------------------------------------------------------------
// Stroke centering helper
// ---------------------------------------------------------------------------

/**
 * Calculates the bounding box of the given vector strokes and shifts them
 * so their center aligns precisely with the center of the canvas.
 */
export function centerStrokesOnCanvas(
  strokes: StrokeData[],
  canvasWidth: number,
  canvasHeight: number
): StrokeData[] {
  if (!strokes || strokes.length === 0) return strokes;

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let pointCount = 0;

  for (const stroke of strokes) {
    if (!stroke.segments) continue;
    for (const seg of stroke.segments) {
      if (seg?.point && typeof seg.point.x === 'number' && typeof seg.point.y === 'number') {
        const { x, y } = seg.point;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        pointCount++;
      }
    }
  }

  if (pointCount === 0 || !isFinite(minX) || !isFinite(maxX) || !isFinite(minY) || !isFinite(maxY)) {
    return strokes;
  }

  const glyphCenterX = (minX + maxX) / 2;
  const glyphCenterY = (minY + maxY) / 2;
  const targetCenterX = canvasWidth / 2;
  const targetCenterY = canvasHeight / 2;
  const dx = Math.round(targetCenterX - glyphCenterX);
  const dy = Math.round(targetCenterY - glyphCenterY);

  if (dx === 0 && dy === 0) {
    return strokes;
  }

  return strokes.map((stroke) => {
    if (!stroke.segments) return stroke;
    return {
      ...stroke,
      segments: stroke.segments.map((seg) => {
        if (!seg || !seg.point) return seg;
        return {
          ...seg,
          point: {
            ...seg.point,
            x: Math.round(seg.point.x + dx),
            y: Math.round(seg.point.y + dy),
          },
        };
      }),
    };
  });
}

// ---------------------------------------------------------------------------
// Main loader
// ---------------------------------------------------------------------------

/**
 * Loads a glyph into the drawing pad.
 *
 * Priority:
 *   1. If `composition.strokes` (or root `strokes`) are present, replay them directly
 *      — this faithfully restores the exact drawing, centered on the canvas.
 *   2. If not directly attached, check the admin and workshop draft stores.
 *   3. Otherwise synthesise a complete formation using interpolated Atrament StrokeData
 *      (outer circle + effector circle + cardinal diamonds + diagonal X markers).
 */
export async function loadGlyphIntoCanvas(
  canvasRef: DrawingCanvasRef | null,
  glyph: WorkshopGlyphItem | AdminGlyphItem | any
): Promise<boolean> {
  if (!canvasRef) {
    console.warn('[glyph_canvas_loader] No DrawingCanvasRef provided.');
    return false;
  }

  const canvasEl = canvasRef.getCanvasElement();
  if (!canvasEl) {
    console.warn('[glyph_canvas_loader] Canvas element not available.');
    return false;
  }

  const rect = canvasEl.getBoundingClientRect();
  const parentRect = canvasEl.parentElement?.getBoundingClientRect();
  const W = Math.round(rect.width || parentRect?.width || canvasEl.clientWidth || canvasEl.width || 500);
  const H = Math.round(rect.height || parentRect?.height || canvasEl.clientHeight || canvasEl.height || 500);
  if (canvasEl.width !== W || canvasEl.height !== H) {
    canvasEl.width = W;
    canvasEl.height = H;
  }

  // --- Path 1: replay saved vector strokes ---
  let rawStrokes: StrokeData[] | undefined =
    (glyph.composition?.strokes as StrokeData[] | undefined) ??
    (glyph.composition as GlyphComposition | undefined)?.strokes as StrokeData[] | undefined;

  // Fallback: check stores if strokes were not attached to the catalog item
  if (!rawStrokes || !Array.isArray(rawStrokes) || rawStrokes.length === 0) {
    if (typeof window !== 'undefined') {
      try {
        const { useAdminGlyphsStore } = await import('../stores/admin_glyphs_store');
        const adminItem = useAdminGlyphsStore.getState().getGlyphById(glyph.id);
        if (adminItem?.composition?.strokes && adminItem.composition.strokes.length > 0) {
          rawStrokes = adminItem.composition.strokes as StrokeData[];
        } else {
          const { useWorkshopDraftStore } = await import('../stores/workshop_draft_store');
          const wsDraft = useWorkshopDraftStore.getState().workshopDraft;
          const wsStrokes = useWorkshopDraftStore.getState().workshopDraftStrokes;
          if (wsStrokes && wsStrokes.length > 0 && (wsDraft?.id === glyph.id || glyph.isDraft)) {
            rawStrokes = wsStrokes;
          }
        }
      } catch (err) {
        console.warn('[glyph_canvas_loader] Failed to resolve fallback strokes from stores', err);
      }
    }
  }

  if (Array.isArray(rawStrokes) && rawStrokes.length > 0) {
    const centeredStrokes = centerStrokesOnCanvas(rawStrokes, W, H);
    canvasRef.loadStrokes(centeredStrokes);
    return true;
  }

  // --- Path 2: synthesise formation as pure Atrament strokes ---
  console.log("Synthesised load")
  const cx = W / 2;
  const cy = H / 2;
  const R = Math.min(W, H) * 0.38;

  const inkColor = '#2a2421';
  const slotColor = '#4a3428';
  let t = Date.now();

  const all: StrokeData[] = [];

  // 1. Outer boundary circle
  all.push(generateCircleStroke(cx, cy, R, { color: inkColor, weight: 3.5, segmentsCount: 96 }));
  t += 600;

  // 2. Centre effector circle
  all.push(generateSmallCircleStroke(cx, cy, R * 0.28, slotColor, 10, t, 32));
  t += 300;

  // 3. Cardinal direction anchors (diamonds at N / E / S / W)
  const cardDist = R * 0.62;
  const cardSize = R * 0.24;
  const compDirs = glyph.composition?.directions;

  const wantsCardinal = (card: 'top' | 'bottom' | 'left' | 'right', alias: string): boolean => {
    if (!compDirs) return true;
    if (Array.isArray(compDirs)) {
      if (compDirs.length === 0) return true;
      return compDirs.some((d: string) => {
        const lc = String(d).toLowerCase();
        return lc === card || lc === alias.toLowerCase();
      });
    }
    if (typeof compDirs === 'object') {
      return Boolean(compDirs[card as keyof typeof compDirs] || compDirs[alias.toLowerCase() as keyof typeof compDirs]);
    }
    return true;
  };

  const cardSlots: Array<{ card: 'top' | 'bottom' | 'left' | 'right'; alias: string; x: number; y: number }> = [
    { card: 'top', alias: 'North', x: cx, y: cy - cardDist },
    { card: 'bottom', alias: 'South', x: cx, y: cy + cardDist },
    { card: 'left', alias: 'West', x: cx - cardDist, y: cy },
    { card: 'right', alias: 'East', x: cx + cardDist, y: cy },
  ];

  for (const s of cardSlots) {
    if (wantsCardinal(s.card, s.alias)) {
      all.push(generateDiamondStroke(s.x, s.y, cardSize, slotColor, 2.5, t));
      t += 120;
    }
  }

  // 4. Diagonal form augmentor slots (X markers at 4 corners)
  const diagDist = R * 0.52;
  const diagSize = R * 0.22;

  const diagSlots = [
    { x: cx - diagDist, y: cy - diagDist }, // topLeft
    { x: cx + diagDist, y: cy - diagDist }, // topRight
    { x: cx - diagDist, y: cy + diagDist }, // bottomLeft
    { x: cx + diagDist, y: cy + diagDist }, // bottomRight
  ];

  for (const s of diagSlots) {
    all.push(...generateXMarkerStrokes(s.x, s.y, diagSize, slotColor, 2.5, t));
    t += 80;
  }

  // Load everything as one batch — Atrament clears + replays atomically
  canvasRef.loadStrokes(all);
  return true;
}
