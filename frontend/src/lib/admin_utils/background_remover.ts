/**
 * ==============================================================================
 * BACKGROUND REMOVER UTILITY
 * Detached, headless image processing library for removing backgrounds,
 * un-bleeding halos, and auto-trimming sigil & artwork graphics.
 * ==============================================================================
 */

export interface BackgroundRemovalOptions {
  /**
   * Color tolerance threshold (0 - 100). Default is 25.
   * Higher values remove more near-background shades.
   */
  tolerance?: number;

  /**
   * Edge feathering width for smooth anti-aliasing (0 - 50). Default is 15.
   */
  feather?: number;

  /**
   * Target background color to remove.
   * If not provided, automatically detected from edge and corner pixels.
   */
  targetColor?: { r: number; g: number; b: number };

  /**
   * If true, only removes background connected to the image boundaries (flood-fill).
   * If false, removes all pixels matching the background color throughout the image.
   * Default is false.
   */
  contiguousOnly?: boolean;

  /**
   * Whether to remove white/light halo bleeding from semi-transparent stroke edges.
   * Default is true.
   */
  removeHalo?: boolean;

  /**
   * Whether to auto-crop empty transparent borders around the subject.
   * Default is false.
   */
  autoTrim?: boolean;

  /**
   * Padding in pixels to keep when autoTrim is true. Default is 16.
   */
  trimPadding?: number;
}

/**
 * Loads an image from a File, Blob, DataURL string, HTMLImageElement, or HTMLCanvasElement.
 */
export function loadImageElement(source: string | File | Blob | HTMLImageElement | HTMLCanvasElement): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    if (source instanceof HTMLImageElement) {
      if (source.complete && source.naturalWidth > 0) {
        resolve(source);
      } else {
        source.onload = () => resolve(source);
        source.onerror = (err) => reject(err);
      }
      return;
    }

    if (typeof HTMLCanvasElement !== 'undefined' && source instanceof HTMLCanvasElement) {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = (err) => reject(err);
      img.src = source.toDataURL();
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';

    if (typeof source === 'string') {
      img.onload = () => resolve(img);
      img.onerror = (err) => reject(err);
      img.src = source;
    } else if (source instanceof Blob) {
      const reader = new FileReader();
      reader.onload = () => {
        img.onload = () => resolve(img);
        img.onerror = (err) => reject(err);
        img.src = reader.result as string;
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(source as Blob);
    }
  });
}

/**
 * Samples image corners and border edges to detect the primary background color.
 */
function detectBackgroundColor(ctx: CanvasRenderingContext2D, width: number, height: number): { r: number; g: number; b: number } {
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  // Sample corner points and mid-edge points
  const samplePoints = [
    [0, 0],
    [width - 1, 0],
    [0, height - 1],
    [width - 1, height - 1],
    [Math.floor(width / 2), 0],
    [Math.floor(width / 2), height - 1],
    [0, Math.floor(height / 2)],
    [width - 1, Math.floor(height / 2)],
  ];

  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  let count = 0;

  for (const [x, y] of samplePoints) {
    const idx = (y * width + x) * 4;
    const a = data[idx + 3];
    // If corners are already transparent, assume white background
    if (a < 128) {
      return { r: 255, g: 255, b: 255 };
    }
    sumR += data[idx];
    sumG += data[idx + 1];
    sumB += data[idx + 2];
    count++;
  }

  return {
    r: Math.round(sumR / count),
    g: Math.round(sumG / count),
    b: Math.round(sumB / count),
  };
}

/**
 * Calculates Euclidean color distance between two RGB colors (0 to 100 scale).
 */
function colorDistance(
  r1: number,
  g1: number,
  b1: number,
  r2: number,
  g2: number,
  b2: number
): number {
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  // Maximum possible distance is sqrt(255^2 * 3) ≈ 441.67
  return (Math.sqrt(dr * dr + dg * dg + db * db) / 441.67) * 100;
}

/**
 * Removes background from an image and returns a transparent PNG Data URL.
 * Headless, detached, and reusable anywhere in the application.
 */
export async function removeImageBackground(
  source: string | File | Blob | HTMLImageElement | HTMLCanvasElement,
  options: BackgroundRemovalOptions = {}
): Promise<string> {
  const {
    tolerance = 25,
    feather = 15,
    targetColor,
    contiguousOnly = false,
    removeHalo = true,
    autoTrim = false,
    trimPadding = 16,
  } = options;

  let width: number;
  let height: number;
  let drawable: CanvasImageSource;

  if (typeof HTMLCanvasElement !== 'undefined' && source instanceof HTMLCanvasElement) {
    width = source.width;
    height = source.height;
    drawable = source;
  } else {
    const img = await loadImageElement(source);
    width = img.naturalWidth || img.width;
    height = img.naturalHeight || img.height;
    drawable = img;
  }

  if (width === 0 || height === 0) {
    throw new Error('Invalid image dimensions');
  }

  // Draw image on off-screen canvas
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    throw new Error('Failed to get 2D canvas context');
  }

  ctx.drawImage(drawable, 0, 0);

  // Detect background color if not provided
  const bg = targetColor || detectBackgroundColor(ctx, width, height);

  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;
  const totalPixels = width * height;

  if (contiguousOnly) {
    // ─── FLOOD-FILL MODE (From Edges) ───
    const isBackground = new Uint8Array(totalPixels);
    const visited = new Uint8Array(totalPixels);
    const queue: number[] = [];

    // Push all border pixels to start queue
    for (let x = 0; x < width; x++) {
      queue.push(x); // Top row
      queue.push((height - 1) * width + x); // Bottom row
    }
    for (let y = 1; y < height - 1; y++) {
      queue.push(y * width); // Left column
      queue.push(y * width + (width - 1)); // Right column
    }

    while (queue.length > 0) {
      const idx = queue.pop()!;
      if (visited[idx]) continue;
      visited[idx] = 1;

      const pIdx = idx * 4;
      const r = data[pIdx];
      const g = data[pIdx + 1];
      const b = data[pIdx + 2];
      const d = colorDistance(r, g, b, bg.r, bg.g, bg.b);

      if (d <= tolerance) {
        isBackground[idx] = 1;

        // Add 4-way neighbors
        const px = idx % width;
        const py = Math.floor(idx / width);

        if (px > 0 && !visited[idx - 1]) queue.push(idx - 1);
        if (px < width - 1 && !visited[idx + 1]) queue.push(idx + 1);
        if (py > 0 && !visited[idx - width]) queue.push(idx - width);
        if (py < height - 1 && !visited[idx + width]) queue.push(idx + width);
      }
    }

    // Apply alpha based on flood-fill mask
    for (let i = 0; i < totalPixels; i++) {
      if (isBackground[i]) {
        data[i * 4 + 3] = 0;
      }
    }
  } else {
    // ─── GLOBAL SMOOTH THRESHOLD MODE ───
    const minD = Math.max(0, tolerance - feather / 2);
    const maxD = Math.min(100, tolerance + feather / 2);
    const range = Math.max(1, maxD - minD);

    for (let i = 0; i < totalPixels; i++) {
      const idx = i * 4;
      const a = data[idx + 3];
      if (a === 0) continue;

      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      const d = colorDistance(r, g, b, bg.r, bg.g, bg.b);

      if (d <= minD) {
        // Completely background
        data[idx + 3] = 0;
      } else if (d < maxD) {
        // Anti-aliased transition edge
        const factor = (d - minD) / range;
        const newAlpha = Math.round(factor * a);
        data[idx + 3] = newAlpha;

        if (removeHalo && newAlpha > 0 && newAlpha < 255) {
          // De-bleed background color from the edge pixels
          const alphaNorm = newAlpha / 255;
          data[idx] = Math.min(255, Math.max(0, Math.round((r - bg.r * (1 - alphaNorm)) / alphaNorm)));
          data[idx + 1] = Math.min(255, Math.max(0, Math.round((g - bg.g * (1 - alphaNorm)) / alphaNorm)));
          data[idx + 2] = Math.min(255, Math.max(0, Math.round((b - bg.b * (1 - alphaNorm)) / alphaNorm)));
        }
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);

  // ─── AUTO-TRIM BORDERS (OPTIONAL) ───
  if (autoTrim) {
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const alpha = data[(y * width + x) * 4 + 3];
        if (alpha > 15) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (maxX >= minX && maxY >= minY) {
      const cropW = maxX - minX + 1;
      const cropH = maxY - minY + 1;

      const trimmedCanvas = document.createElement('canvas');
      trimmedCanvas.width = cropW + trimPadding * 2;
      trimmedCanvas.height = cropH + trimPadding * 2;
      const trimmedCtx = trimmedCanvas.getContext('2d');

      if (trimmedCtx) {
        trimmedCtx.drawImage(
          canvas,
          minX,
          minY,
          cropW,
          cropH,
          trimPadding,
          trimPadding,
          cropW,
          cropH
        );
        return trimmedCanvas.toDataURL('image/png');
      }
    }
  }

  return canvas.toDataURL('image/png');
}
