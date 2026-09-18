/**
 * @file spriteProcessor.ts
 * @description High-performance client-side image processing utility for pixel art sprites:
 * - Chroma Key background removal (e.g. #FF00FF magenta)
 * - Automatic character bounding box detection
 * - Headroom & ground-line normalization onto 1024x1024 anchor canvas
 * - Crisp 4x nearest-neighbor downscaling to 256x256 in-game sprite frames
 * - Sprite sheet generation with Phaser 3 animation config
 */

export interface ColorRGB {
  r: number;
  g: number;
  b: number;
}

export interface BoundingBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width: number;
  height: number;
  centerX?: number; // True horizontal center of the character (torso/spine core)
}

export interface NormalizationConfig {
  targetCanvasSize: number; // e.g. 1024
  targetHeightPercent: number; // e.g. 68 (meaning 68% of 1024 = ~696px)
  bottomBaselinePercent: number; // e.g. 8 (ground margin at bottom, ~80px)
  horizontalCenterPercent: number; // default 50 (exact center), range 20 to 80
  autoCenterHorizontal: boolean;
  outputLogicalSize: number; // e.g. 256
  referenceHeight?: number; // Standing/average reference height to maintain relative scale for crouch/bending frames
}

export const DEFAULT_NORMALIZATION: NormalizationConfig = {
  targetCanvasSize: 1024,
  targetHeightPercent: 75, // 768 px height (192 game px)
  bottomBaselinePercent: 13, // 133 px bottom ground margin (33 game px), canonical even padding
  horizontalCenterPercent: 50, // default exact center (50%)
  autoCenterHorizontal: true,
  outputLogicalSize: 256,
};

/**
 * Converts a hex color string (e.g. "#FF00FF") to RGB components.
 */
export function hexToRgb(hex: string): ColorRGB {
  const clean = hex.replace('#', '');
  const bigint = parseInt(clean, 16);
  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255,
  };
}

/**
 * Calculates Euclidean color distance in RGB space.
 */
function colorDistance(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): number {
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

/**
 * Loads an HTMLImageElement from an image File or blob URL.
 */
export function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };
    img.src = url;
  });
}

/**
 * Loads an HTMLImageElement from a URL string.
 */
export function loadImageFromUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = url;
  });
}

/**
 * Removes chroma key background color from an image canvas.
 * Supports:
 * - Color distance threshold
 * - Edge feathering
 * - "Clean up edges" (alpha choke/erosion) to remove fuzzy semi-transparent pixels from boundary
 * - Color spill suppression (neutralizing residual magenta/green tint on outline)
 */
export function removeChromaBackground(
  source: HTMLImageElement | HTMLCanvasElement,
  chromaColor: ColorRGB,
  tolerance: number = 45, // 0 to 255 distance threshold
  smoothness: number = 4, // feather edge threshold
  cleanUpEdges: number = 2 // pixels to erode / clean up fuzzy semi-transparent edges
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const w = source.width;
  const h = source.height;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return canvas;

  ctx.drawImage(source, 0, 0);
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  // 1. Initial Chroma Key & Spill Detection
  const isMagenta = chromaColor.r > 200 && chromaColor.b > 200 && chromaColor.g < 80;
  const isGreen = chromaColor.g > 200 && chromaColor.r < 80 && chromaColor.b < 80;

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue; // Skip already-transparent pixels

    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    const dist = colorDistance(r, g, b, chromaColor.r, chromaColor.g, chromaColor.b);

    if (dist <= tolerance) {
      data[i + 3] = 0; // Transparent
    } else if (dist < tolerance + smoothness) {
      const alpha = (dist - tolerance) / smoothness;
      data[i + 3] = Math.round(data[i + 3] * alpha);
    }
  }

  // 1b. Exterior Border Flood-Fill:
  // Guarantees that subtle background vignetting or corner compression artifacts
  // connected to the outer perimeter are wiped cleanly even at low tolerance settings,
  // without ever affecting foreground pixels of the character.
  const maxBorderDist = Math.max(tolerance * 1.5, tolerance + 25, 60);
  const queue = new Int32Array(w * h);
  const visited = new Uint8Array(w * h);
  let qHead = 0;
  let qTail = 0;

  for (let x = 0; x < w; x++) {
    queue[qTail++] = x;
    visited[x] = 1;
    const bIdx = (h - 1) * w + x;
    queue[qTail++] = bIdx;
    visited[bIdx] = 1;
  }
  for (let y = 1; y < h - 1; y++) {
    const lIdx = y * w;
    queue[qTail++] = lIdx;
    visited[lIdx] = 1;
    const rIdx = y * w + (w - 1);
    queue[qTail++] = rIdx;
    visited[rIdx] = 1;
  }

  while (qHead < qTail) {
    const curr = queue[qHead++];
    const pIdx = curr * 4;
    const r = data[pIdx];
    const g = data[pIdx + 1];
    const b = data[pIdx + 2];
    const d = colorDistance(r, g, b, chromaColor.r, chromaColor.g, chromaColor.b);

    const isAlreadyTransparent = data[pIdx + 3] === 0;
    if (isAlreadyTransparent || d <= maxBorderDist) {
      data[pIdx + 3] = 0;

      const cy = Math.floor(curr / w);
      const cx = curr % w;

      if (cy > 0) {
        const n = (cy - 1) * w + cx;
        if (!visited[n]) { visited[n] = 1; queue[qTail++] = n; }
      }
      if (cy < h - 1) {
        const n = (cy + 1) * w + cx;
        if (!visited[n]) { visited[n] = 1; queue[qTail++] = n; }
      }
      if (cx > 0) {
        const n = cy * w + (cx - 1);
        if (!visited[n]) { visited[n] = 1; queue[qTail++] = n; }
      }
      if (cx < w - 1) {
        const n = cy * w + (cx + 1);
        if (!visited[n]) { visited[n] = 1; queue[qTail++] = n; }
      }
    }
  }

  // 2. Clean up edges (Morphological Alpha Choke / Erode)
  // Removes fuzzy, semi-transparent pixels and compression bleed from the border
  if (cleanUpEdges > 0) {
    for (let pass = 0; pass < cleanUpEdges; pass++) {
      const pixelsToClear: number[] = [];

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const idx = (y * w + x) * 4;
          const alpha = data[idx + 3];

          if (alpha === 0) continue;

          // If semi-transparent, immediately remove
          if (alpha < 240) {
            pixelsToClear.push(idx);
            continue;
          }

          // Check 4-neighbor connectivity for transparency
          const hasTransparentNeighbor =
            (x > 0 && data[(y * w + (x - 1)) * 4 + 3] === 0) ||
            (x < w - 1 && data[(y * w + (x + 1)) * 4 + 3] === 0) ||
            (y > 0 && data[((y - 1) * w + x) * 4 + 3] === 0) ||
            (y < h - 1 && data[((y + 1) * w + x) * 4 + 3] === 0);

          if (hasTransparentNeighbor) {
            // Check if this border pixel has chroma bleed
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            const dist = colorDistance(r, g, b, chromaColor.r, chromaColor.g, chromaColor.b);

            // If it has any noticeable chroma similarity, clear it
            if (dist < tolerance * 1.8) {
              pixelsToClear.push(idx);
            }
          }
        }
      }

      for (let i = 0; i < pixelsToClear.length; i++) {
        data[pixelsToClear[i] + 3] = 0;
      }
    }

    // 3. Despill Pass: Neutralize any remaining tint on the outermost border pixels
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        if (data[idx + 3] === 0) continue;

        const isBorder =
          (x > 0 && data[(y * w + (x - 1)) * 4 + 3] === 0) ||
          (x < w - 1 && data[(y * w + (x + 1)) * 4 + 3] === 0) ||
          (y > 0 && data[((y - 1) * w + x) * 4 + 3] === 0) ||
          (y < h - 1 && data[((y + 1) * w + x) * 4 + 3] === 0);

        if (isBorder) {
          if (isMagenta) {
            // Magenta despill: clamp Red and Blue towards Green
            const g = data[idx + 1];
            if (data[idx] > g && data[idx + 2] > g) {
              const maxAllowed = Math.min(data[idx], data[idx + 2]);
              const spill = maxAllowed - g;
              data[idx] = Math.max(0, data[idx] - spill);
              data[idx + 2] = Math.max(0, data[idx + 2] - spill);
            }
          } else if (isGreen) {
            // Green despill
            const avgRB = (data[idx] + data[idx + 2]) / 2;
            if (data[idx + 1] > avgRB) {
              data[idx + 1] = Math.round(avgRB);
            }
          }
        }
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

/**
 * Finds the tightest bounding box enclosing the primary foreground character.
 * Uses connected-component labeling on a downsampled grid to isolate the central
 * character from any residual corner noise, border artifacts, or compression blocks.
 * This guarantees that changes to Color Distance Tolerance never cause character scaling
 * or horizontal centering jumps.
 */
export function getNonTransparentBounds(
  canvas: HTMLCanvasElement,
  alphaThreshold: number = 25
): BoundingBox | null {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  const w = canvas.width;
  const h = canvas.height;
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  // Downsample alpha to a 256x256 grid (step = 4) for instantaneous connected-component analysis (~1ms)
  const step = 4;
  const gw = Math.ceil(w / step);
  const gh = Math.ceil(h / step);
  const grid = new Uint8Array(gw * gh);

  for (let gy = 0; gy < gh; gy++) {
    const y0 = gy * step;
    const y1 = Math.min(y0 + step, h);
    for (let gx = 0; gx < gw; gx++) {
      const x0 = gx * step;
      const x1 = Math.min(x0 + step, w);

      let hasPixel = false;
      for (let y = y0; y < y1 && !hasPixel; y++) {
        const rowOffset = y * w * 4;
        for (let x = x0; x < x1; x++) {
          if (data[rowOffset + x * 4 + 3] >= alphaThreshold) {
            hasPixel = true;
            break;
          }
        }
      }
      if (hasPixel) {
        grid[gy * gw + gx] = 1;
      }
    }
  }

  // Connected-component BFS labeling
  const visited = new Uint8Array(gw * gh);
  interface Component {
    minGx: number;
    maxGx: number;
    minGy: number;
    maxGy: number;
    cellCount: number;
    sumGx: number;
    sumGy: number;
    touchesLeft: boolean;
    touchesRight: boolean;
    touchesTop: boolean;
    touchesBottom: boolean;
    isBorderArtifact: boolean;
  }
  const components: Component[] = [];
  const queue = new Int32Array(gw * gh);

  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      const startIdx = gy * gw + gx;
      if (grid[startIdx] === 0 || visited[startIdx] === 1) continue;

      let qHead = 0;
      let qTail = 0;
      queue[qTail++] = startIdx;
      visited[startIdx] = 1;

      let minGx = gx;
      let maxGx = gx;
      let minGy = gy;
      let maxGy = gy;
      let cellCount = 0;
      let sumGx = 0;
      let sumGy = 0;
      let touchesLeft = false;
      let touchesRight = false;
      let touchesTop = false;
      let touchesBottom = false;

      while (qHead < qTail) {
        const curr = queue[qHead++];
        const cy = Math.floor(curr / gw);
        const cx = curr % gw;
        cellCount++;
        sumGx += cx;
        sumGy += cy;

        if (cx < minGx) minGx = cx;
        if (cx > maxGx) maxGx = cx;
        if (cy < minGy) minGy = cy;
        if (cy > maxGy) maxGy = cy;

        if (cx === 0) touchesLeft = true;
        if (cx === gw - 1) touchesRight = true;
        if (cy === 0) touchesTop = true;
        if (cy === gh - 1) touchesBottom = true;

        const neighbors = [
          cy > 0 ? (cy - 1) * gw + cx : -1,
          cy < gh - 1 ? (cy + 1) * gw + cx : -1,
          cx > 0 ? cy * gw + (cx - 1) : -1,
          cx < gw - 1 ? cy * gw + (cx + 1) : -1,
        ];

        for (const nIdx of neighbors) {
          if (nIdx !== -1 && grid[nIdx] === 1 && visited[nIdx] === 0) {
            visited[nIdx] = 1;
            queue[qTail++] = nIdx;
          }
        }
      }

      // A component is ONLY a border artifact if:
      // 1. It spans across opposite horizontal borders (touches both left AND right)
      // 2. It wraps around 3 or more borders (perimeter background frame)
      // 3. It is a thin edge sliver at the extreme borders (maxGx <= 1 or minGx >= gw - 2)
      // NOTE: A character standing on the ground touching ONLY the bottom border (touchesBottom) is NOT an artifact!
      const borderTouchCount = (touchesLeft ? 1 : 0) + (touchesRight ? 1 : 0) + (touchesTop ? 1 : 0) + (touchesBottom ? 1 : 0);
      const spansWidth = touchesLeft && touchesRight;
      const isEdgeSliver = (touchesLeft && maxGx <= 1) || (touchesRight && minGx >= gw - 2);
      const isBorderArtifact = spansWidth || borderTouchCount >= 3 || (isEdgeSliver && cellCount < gw * 2);

      components.push({
        minGx,
        maxGx,
        minGy,
        maxGy,
        cellCount,
        sumGx,
        sumGy,
        touchesLeft,
        touchesRight,
        touchesTop,
        touchesBottom,
        isBorderArtifact,
      });
    }
  }

  if (components.length === 0) return null;

  // Filter out border artifacts and residual frame strips
  const validCandidates = components.filter(
    (c) => !c.isBorderArtifact && c.cellCount >= 6
  );

  let primaryComponent: Component;

  if (validCandidates.length > 0) {
    // Score by cellCount weighted towards horizontal center of frame
    validCandidates.sort((a, b) => {
      const aCenterDist = Math.abs((a.sumGx / a.cellCount) - (gw / 2)) / (gw / 2);
      const bCenterDist = Math.abs((b.sumGx / b.cellCount) - (gw / 2)) / (gw / 2);
      const aScore = a.cellCount * (1 - aCenterDist * 0.4);
      const bScore = b.cellCount * (1 - bCenterDist * 0.4);
      return bScore - aScore;
    });
    primaryComponent = validCandidates[0];
  } else {
    // Fallback: pick component with largest mass that does not span the entire width
    const nonSpanning = components.filter((c) => !(c.touchesLeft && c.touchesRight));
    const pool = nonSpanning.length > 0 ? nonSpanning : components;
    pool.sort((a, b) => b.cellCount - a.cellCount);
    primaryComponent = pool[0];
  }

  // Include any nearby accessories/parts (e.g. hats, weapons, hands separated by a 1px gap)
  let minGx = primaryComponent.minGx;
  let maxGx = primaryComponent.maxGx;
  let minGy = primaryComponent.minGy;
  let maxGy = primaryComponent.maxGy;

  const proximityMargin = 16; // 64 pixels at 4x step
  for (const c of components) {
    if (c === primaryComponent) continue;
    // Reject border artifacts
    if (c.isBorderArtifact) continue;

    if (
      c.maxGx >= minGx - proximityMargin &&
      c.minGx <= maxGx + proximityMargin &&
      c.maxGy >= minGy - proximityMargin &&
      c.minGy <= maxGy + proximityMargin
    ) {
      if (c.minGx < minGx) minGx = c.minGx;
      if (c.maxGx > maxGx) maxGx = c.maxGx;
      if (c.minGy < minGy) minGy = c.minGy;
      if (c.maxGy > maxGy) maxGy = c.maxGy;
    }
  }

  // Refine to pixel-level precision on full resolution image
  const px0 = Math.max(0, minGx * step);
  const px1 = Math.min(w - 1, (maxGx + 1) * step);
  const py0 = Math.max(0, minGy * step);
  const py1 = Math.min(h - 1, (maxGy + 1) * step);

  let exactMinX = px1;
  let exactMaxX = px0;
  let exactMinY = py1;
  let exactMaxY = py0;
  let foundAny = false;

  for (let y = py0; y <= py1; y++) {
    const rowOffset = y * w * 4;
    for (let x = px0; x <= px1; x++) {
      if (data[rowOffset + x * 4 + 3] >= alphaThreshold) {
        if (x < exactMinX) exactMinX = x;
        if (x > exactMaxX) exactMaxX = x;
        if (y < exactMinY) exactMinY = y;
        if (y > exactMaxY) exactMaxY = y;
        foundAny = true;
      }
    }
  }

  if (!foundAny) {
    return {
      minX: px0,
      maxX: px1,
      minY: py0,
      maxY: py1,
      width: px1 - px0 + 1,
      height: py1 - py0 + 1,
      centerX: Math.round((px0 + px1) / 2),
    };
  }

  // Calculate true character center (torso/spine core) across vertical middle 50%
  const charHeight = exactMaxY - exactMinY + 1;
  const torsoY0 = exactMinY + Math.round(charHeight * 0.2);
  const torsoY1 = exactMinY + Math.round(charHeight * 0.7);
  let sumTorsoX = 0;
  let torsoPixels = 0;
  let sumAllX = 0;
  let allPixels = 0;

  for (let y = exactMinY; y <= exactMaxY; y++) {
    const rowOffset = y * w * 4;
    const isTorso = y >= torsoY0 && y <= torsoY1;
    for (let x = exactMinX; x <= exactMaxX; x++) {
      if (data[rowOffset + x * 4 + 3] >= alphaThreshold) {
        sumAllX += x;
        allPixels++;
        if (isTorso) {
          sumTorsoX += x;
          torsoPixels++;
        }
      }
    }
  }

  let centerX: number;
  if (torsoPixels >= 8) {
    centerX = Math.round(sumTorsoX / torsoPixels);
  } else if (allPixels > 0) {
    centerX = Math.round(sumAllX / allPixels);
  } else {
    centerX = Math.round((exactMinX + exactMaxX) / 2);
  }

  return {
    minX: exactMinX,
    maxX: exactMaxX,
    minY: exactMinY,
    maxY: exactMaxY,
    width: exactMaxX - exactMinX + 1,
    height: exactMaxY - exactMinY + 1,
    centerX,
  };
}

/**
 * Normalizes a transparent sprite onto a standard 1024x1024 anchor canvas:
 * - Scales the character so height = targetCanvasSize * (targetHeightPercent / 100)
 * - Sets the foot baseline = targetCanvasSize * (1 - bottomBaselinePercent / 100)
 * - Guarantees calculated headroom above the head
 * - Automatically centers horizontally
 */
export function normalizeSpritePadding(
  transparentCanvas: HTMLCanvasElement,
  bounds: BoundingBox,
  config: NormalizationConfig = DEFAULT_NORMALIZATION
): { canvas: HTMLCanvasElement; bounds: BoundingBox; scale: number; topHeadroomPx: number } {
  const targetSize = config.targetCanvasSize;
  const outCanvas = document.createElement('canvas');
  outCanvas.width = targetSize;
  outCanvas.height = targetSize;
  const ctx = outCanvas.getContext('2d')!;

  // Disable blur interpolation when drawing pixel art
  ctx.imageSmoothingEnabled = false;

  // Calculate target character height
  const desiredHeight = (targetSize * config.targetHeightPercent) / 100;
  // If referenceHeight is provided (e.g. average or max standing height), scale relative to that
  // so bending/crouching frames keep their natural shorter height without blowing up
  const refHeight = config.referenceHeight && config.referenceHeight > 0 ? config.referenceHeight : bounds.height;
  const scale = desiredHeight / refHeight;
  const scaledWidth = bounds.width * scale;
  const scaledHeight = bounds.height * scale;

  // Compute position: anchor character's true center (torso/spine) to target center line
  const baselineY = targetSize * (1 - config.bottomBaselinePercent / 100);
  const destY = baselineY - scaledHeight;
  const hPercent = config.horizontalCenterPercent ?? 50;

  const charCenterX = bounds.centerX !== undefined ? bounds.centerX : (bounds.minX + bounds.width / 2);
  const relCenterX = charCenterX - bounds.minX; // Position of character center relative to bounds.minX

  const targetCenterX = targetSize * (hPercent / 100);
  const destX = targetCenterX - (relCenterX * scale);

  ctx.drawImage(
    transparentCanvas,
    bounds.minX,
    bounds.minY,
    bounds.width,
    bounds.height,
    destX,
    destY,
    scaledWidth,
    scaledHeight
  );

  const newBounds: BoundingBox = {
    minX: Math.round(destX),
    maxX: Math.round(destX + scaledWidth),
    minY: Math.round(destY),
    maxY: Math.round(destY + scaledHeight),
    width: Math.round(scaledWidth),
    height: Math.round(scaledHeight),
    centerX: Math.round(targetCenterX),
  };

  return {
    canvas: outCanvas,
    bounds: newBounds,
    scale,
    topHeadroomPx: Math.round(destY),
  };
}

/**
 * Downscales a 1024x1024 normalized canvas by 4x to 256x256 using razor-sharp Nearest-Neighbor.
 */
export function downscaleNearestNeighbor(
  sourceCanvas: HTMLCanvasElement,
  targetSize: number = 256
): HTMLCanvasElement {
  const downCanvas = document.createElement('canvas');
  downCanvas.width = targetSize;
  downCanvas.height = targetSize;
  const ctx = downCanvas.getContext('2d')!;

  // CRITICAL for pixel art: disable image smoothing for 100% crisp pixel preservation
  ctx.imageSmoothingEnabled = false;

  ctx.drawImage(sourceCanvas, 0, 0, targetSize, targetSize);
  return downCanvas;
}

export interface SpriteSheetPaddingConfig {
  targetCanvasSize?: number;
  outputLogicalSize?: number;
  targetCharacterHeightPx?: number;
  targetCharacterHeightGamePx?: number;
  bottomGroundMarginPx?: number;
  bottomGroundMarginGamePx?: number;
  jumpHeadroomPx?: number;
  jumpHeadroomGamePx?: number;
  groundBaselineYPx?: number;
  groundBaselineYGamePx?: number;
  horizontalCenterPercent?: number;
}

function getFrameContentBounds(canvas: HTMLCanvasElement, alphaThreshold = 20) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const w = canvas.width;
  const h = canvas.height;
  const imgData = ctx.getImageData(0, 0, w, h).data;
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const a = imgData[(y * w + x) * 4 + 3];
      if (a >= alphaThreshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < minX || maxY < minY) return null;
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

/**
 * Stitches an array of downscaled sprite frames into a horizontal sprite sheet strip.
 * Exports comprehensive padding, hitbox offsets, and bounds in the JSON configuration.
 */
export function generateSpriteSheet(
  frames: { name: string; canvas: HTMLCanvasElement }[],
  frameSize: number = 256,
  paddingConfig?: SpriteSheetPaddingConfig
): { canvas: HTMLCanvasElement; phaserConfig: string } {
  const sheetCanvas = document.createElement('canvas');
  sheetCanvas.width = frameSize * frames.length;
  sheetCanvas.height = frameSize;
  const ctx = sheetCanvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  const analyzedFrames = frames.map((frame, idx) => {
    ctx.drawImage(frame.canvas, idx * frameSize, 0, frameSize, frameSize);
    const bounds = getFrameContentBounds(frame.canvas);
    const padTop = bounds ? bounds.minY : 0;
    const padBottom = bounds ? frameSize - 1 - bounds.maxY : 0;
    const padLeft = bounds ? bounds.minX : 0;
    const padRight = bounds ? frameSize - 1 - bounds.maxX : 0;

    return {
      index: idx,
      name: frame.name,
      x: idx * frameSize,
      y: 0,
      width: frameSize,
      height: frameSize,
      contentBounds: bounds
        ? {
            x: bounds.minX,
            y: bounds.minY,
            width: bounds.width,
            height: bounds.height,
          }
        : null,
      padding: {
        top: padTop,
        bottom: padBottom,
        left: padLeft,
        right: padRight,
      },
    };
  });

  // Calculate canonical padding
  const firstFrame = analyzedFrames[0];
  const charHeight = paddingConfig?.targetCharacterHeightGamePx || (firstFrame?.contentBounds?.height ?? Math.round(frameSize * 0.75));
  const bottomMargin = paddingConfig?.bottomGroundMarginGamePx || (firstFrame?.padding?.bottom ?? Math.round(frameSize * 0.12));
  const topHeadroom = paddingConfig?.jumpHeadroomGamePx || (firstFrame?.padding?.top ?? Math.round(frameSize * 0.13));
  const baselineY = paddingConfig?.groundBaselineYGamePx || (frameSize - bottomMargin);
  const suggestedHitboxW = Math.min(80, Math.round(frameSize * 0.35));
  const suggestedHitboxH = charHeight;
  const suggestedOffsetW = Math.round((frameSize - suggestedHitboxW) / 2);
  const suggestedOffsetH = Math.max(0, frameSize - suggestedHitboxH - bottomMargin);

  const phaserConfigObj = {
    texture: 'spritesheet',
    frameWidth: frameSize,
    frameHeight: frameSize,
    totalFrames: frames.length,
    phaserLoadCode: `this.load.spritesheet('player_idle', 'path/to/spritesheet.png', { frameWidth: ${frameSize}, frameHeight: ${frameSize}, margin: 0, spacing: 0 });`,
    padding: {
      unit: 'game pixels',
      frameSize,
      targetCharacterHeight: charHeight,
      bottomGroundMargin: bottomMargin,
      jumpHeadroom: topHeadroom,
      groundBaselineY: baselineY,
      horizontalCenterPercent: paddingConfig?.horizontalCenterPercent ?? 50,
      topPadding: topHeadroom,
      bottomPadding: bottomMargin,
      leftPadding: firstFrame?.padding?.left ?? 0,
      rightPadding: firstFrame?.padding?.right ?? 0,
      ...(paddingConfig?.targetCanvasSize
        ? {
            masterCanvas1024Measurements: {
              canvasSize: paddingConfig.targetCanvasSize,
              characterHeightPx: paddingConfig.targetCharacterHeightPx,
              bottomGroundMarginPx: paddingConfig.bottomGroundMarginPx,
              jumpHeadroomPx: paddingConfig.jumpHeadroomPx,
              groundBaselineYPx: paddingConfig.groundBaselineYPx,
            },
          }
        : {}),
      hitboxRecommendation: {
        note: 'Apply these hitbox sizes & offsets in Phaser so character feet sit flush on the ground without hovering:',
        hitboxWidth: suggestedHitboxW,
        hitboxHeight: suggestedHitboxH,
        offsetX: suggestedOffsetW,
        offsetY: suggestedOffsetH,
        offsetXFormula: '(frameWidth - hitboxWidth) / 2',
        offsetYFormula: 'frameHeight - hitboxHeight - bottomGroundMargin',
        phaserSnippet: `this.player.body.setSize(${suggestedHitboxW}, ${suggestedHitboxH}); this.player.body.setOffset(${suggestedOffsetW}, ${suggestedOffsetH});`,
      },
    },
    frames: analyzedFrames,
  };

  const phaserConfig = JSON.stringify(phaserConfigObj, null, 2);

  return { canvas: sheetCanvas, phaserConfig };
}

/**
 * Helper to download a canvas directly as a PNG file.
 */
export function downloadCanvasAsPng(canvas: HTMLCanvasElement, filename: string) {
  const link = document.createElement('a');
  link.download = filename.endsWith('.png') ? filename : `${filename}.png`;
  link.href = canvas.toDataURL('image/png');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// ─────────────────────────────────────────────────────────────────────────────
// Sprite Sheet Frame Detection
// ─────────────────────────────────────────────────────────────────────────────

export interface DetectedFrame {
  /** Zero-based index */
  index: number;
  /** X offset in source image pixels */
  x: number;
  /** Y offset in source image pixels */
  y: number;
  /** Width in source image pixels */
  w: number;
  /** Height in source image pixels */
  h: number;
}

/**
 * Auto-detects sprite frame boundaries in a sprite sheet image.
 *
 * Strategy:
 *  1. If `hint.cols` and `hint.rows` are both provided → uniform grid split.
 *  2. Otherwise scan for fully-transparent gap columns and rows.
 *     Content segments between gaps become individual frame rectangles.
 *  3. If no gaps are found at all, fall back to a 1-column / 1-row grid
 *     (i.e. the whole image is one frame).
 */
export type TileAlignment = 'HORIZONTAL' | 'VERTICAL' | 'CUSTOM_GRID';

export interface SpriteSheetDetectOptions {
  alignment?: TileAlignment;
  cols?: number;
  rows?: number;
  limit?: number;
}

/**
 * Automatically detects individual frame bounding boxes in a sprite sheet image.
 *
 * Slicing strategies:
 * 1. If cols & rows (or alignment) are supplied, slices via uniform grid geometry.
 * 2. If no hints, performs transparent gap projection analysis (column & row gutters).
 * 3. Falls back to aspect ratio heuristics or single whole image.
 *
 * The alpha threshold for "transparent" is 8/255 so near-invisible edge
 * artefacts don't break gap detection.
 */
export function detectSpriteSheetFrames(
  image: HTMLImageElement,
  hint?: SpriteSheetDetectOptions,
): DetectedFrame[] {
  const { width, height } = image;
  let cols = hint?.cols ?? 0;
  let rows = hint?.rows ?? 0;

  if (hint?.alignment === 'HORIZONTAL') {
    rows = 1;
    if (cols <= 0) cols = Math.max(1, Math.round(width / height));
  } else if (hint?.alignment === 'VERTICAL') {
    cols = 1;
    if (rows <= 0) rows = Math.max(1, Math.round(height / width));
  }

  // ── Uniform grid shortcut ──────────────────────────────────────────────────
  if (cols > 0 && rows > 0) {
    return buildUniformGrid(width, height, cols, rows, hint?.limit);
  }

  // ── Read pixel data ────────────────────────────────────────────────────────
  const offscreen = document.createElement('canvas');
  offscreen.width = width;
  offscreen.height = height;
  const ctx = offscreen.getContext('2d')!;
  ctx.drawImage(image, 0, 0);
  const { data } = ctx.getImageData(0, 0, width, height);
  const ALPHA_IDX = 3;
  const ALPHA_THRESH = 8;

  // ── Find gap columns (all pixels fully transparent) ────────────────────────
  const isEmptyCol = (x: number): boolean => {
    for (let y = 0; y < height; y++) {
      if (data[(y * width + x) * 4 + ALPHA_IDX] > ALPHA_THRESH) return false;
    }
    return true;
  };

  // ── Find gap rows ──────────────────────────────────────────────────────────
  const isEmptyRow = (y: number): boolean => {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + ALPHA_IDX] > ALPHA_THRESH) return false;
    }
    return true;
  };

  // ── Build content segments along one axis ─────────────────────────────────
  const getContentSegments = (
    length: number,
    isEmpty: (i: number) => boolean,
  ): { start: number; end: number }[] => {
    const segments: { start: number; end: number }[] = [];
    let inContent = false;
    let segStart = 0;
    for (let i = 0; i < length; i++) {
      const empty = isEmpty(i);
      if (!empty && !inContent) {
        inContent = true;
        segStart = i;
      } else if (empty && inContent) {
        inContent = false;
        segments.push({ start: segStart, end: i });
      }
    }
    if (inContent) segments.push({ start: segStart, end: length });
    return segments;
  };

  const colSegs = getContentSegments(width, isEmptyCol);
  const rowSegs = getContentSegments(height, isEmptyRow);

  // ── If no gaps detected, try to guess from aspect ratio ───────────────────
  if (colSegs.length <= 1 && rowSegs.length <= 1) {
    // Heuristic: check if width is a clean multiple of height (row strip)
    for (const divisor of [8, 7, 6, 5, 4, 3, 2]) {
      if (width % divisor === 0 && width / divisor === height) {
        return buildUniformGrid(width, height, divisor, 1, hint?.limit);
      }
      if (height % divisor === 0 && height / divisor === width) {
        return buildUniformGrid(width, height, 1, divisor, hint?.limit);
      }
    }
    // Fallback: whole image = single frame
    return [{ index: 0, x: 0, y: 0, w: width, h: height }];
  }

  // ── Build frames from content segments ────────────────────────────────────
  const frames: DetectedFrame[] = [];
  let idx = 0;
  for (const rSeg of rowSegs) {
    for (const cSeg of colSegs) {
      if (hint?.limit && idx >= hint.limit) break;
      frames.push({
        index: idx++,
        x: cSeg.start,
        y: rSeg.start,
        w: cSeg.end - cSeg.start,
        h: rSeg.end - rSeg.start,
      });
    }
    if (hint?.limit && idx >= hint.limit) break;
  }
  return frames;
}

/**
 * Builds a uniform grid of frame rectangles.
 */
export function buildUniformGrid(
  imgW: number,
  imgH: number,
  cols: number,
  rows: number,
  limit?: number,
): DetectedFrame[] {
  const fw = Math.floor(imgW / cols);
  const fh = Math.floor(imgH / rows);
  const frames: DetectedFrame[] = [];
  const max = limit && limit > 0 ? Math.min(limit, cols * rows) : cols * rows;
  for (let i = 0; i < max; i++) {
    const r = Math.floor(i / cols);
    const c = i % cols;
    frames.push({
      index: i,
      x: c * fw,
      y: r * fh,
      w: fw,
      h: fh,
    });
  }
  return frames;
}

/**
 * Extracts a single frame from a source image as a standalone canvas.
 */
export function extractFrameCanvas(
  image: HTMLImageElement,
  frame: DetectedFrame,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = frame.w;
  canvas.height = frame.h;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(image, frame.x, frame.y, frame.w, frame.h, 0, 0, frame.w, frame.h);
  return canvas;
}
