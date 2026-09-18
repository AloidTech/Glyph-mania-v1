/**
 * @file videoFrameExtractor.ts
 * @description Client-side video frame extraction and animation cycle processing:
 * - Extracts frames from video files (.mp4, .webm, .mov) frame-by-frame via HTML5 Canvas
 * - Real-time extraction progress reporting
 * - Synthetic demo walk cycle generator for instant testing
 * - Sprite sheet and individual frame export
 */

export interface ExtractedFrame {
  index: number;
  timeSeconds: number;
  canvas: HTMLCanvasElement;
  dataUrl: string;
}

/**
 * Extracts frames from a user-uploaded video file at a specified frame rate or step interval.
 */
export async function extractFramesFromVideo(
  videoFile: File,
  options: {
    fps?: number; // e.g. 24 or 30
    maxFrames?: number; // safety cap (default 150)
    onProgress?: (current: number, total: number) => void;
  } = {}
): Promise<ExtractedFrame[]> {
  const fps = options.fps || 24;
  const maxFrames = options.maxFrames || 150;
  const onProgress = options.onProgress;

  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;

    const url = URL.createObjectURL(videoFile);
    video.src = url;

    video.onloadedmetadata = async () => {
      try {
        const duration = video.duration;
        const width = video.videoWidth;
        const height = video.videoHeight;

        if (!duration || duration === Infinity) {
          throw new Error('Could not determine video duration.');
        }

        const totalFrames = Math.min(Math.floor(duration * fps), maxFrames);
        const frameInterval = 1 / fps;
        const frames: ExtractedFrame[] = [];

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

        for (let i = 0; i < totalFrames; i++) {
          const seekTime = i * frameInterval;
          await seekVideo(video, seekTime);

          ctx.drawImage(video, 0, 0, width, height);

          // Clone to individual frame canvas
          const frameCanvas = document.createElement('canvas');
          frameCanvas.width = width;
          frameCanvas.height = height;
          const frameCtx = frameCanvas.getContext('2d')!;
          frameCtx.imageSmoothingEnabled = false;
          frameCtx.drawImage(canvas, 0, 0);

          frames.push({
            index: i,
            timeSeconds: seekTime,
            canvas: frameCanvas,
            dataUrl: frameCanvas.toDataURL('image/png'),
          });

          if (onProgress) {
            onProgress(i + 1, totalFrames);
          }
        }

        URL.revokeObjectURL(url);
        resolve(frames);
      } catch (err) {
        URL.revokeObjectURL(url);
        reject(err);
      }
    };

    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load video file.'));
    };
  });
}

function seekVideo(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve) => {
    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked);
      resolve();
    };
    video.addEventListener('seeked', onSeeked);
    video.currentTime = Math.min(time, video.duration);
  });
}

/**
 * Generates an 8-frame synthetic pixel-art demo walk cycle for immediate testing.
 */
export function generateDemoWalkCycle(): ExtractedFrame[] {
  const frames: ExtractedFrame[] = [];
  const total = 12;
  const size = 512;

  for (let i = 0; i < total; i++) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    // Green screen background
    ctx.fillStyle = '#00FF00';
    ctx.fillRect(0, 0, size, size);

    // Draw simple animated walking character
    const phase = (i / total) * Math.PI * 2;
    const bob = Math.sin(phase * 2) * 8;
    const legSwing = Math.sin(phase) * 24;

    const cx = size / 2;
    const cy = size / 2 - 20 + bob;

    // Body/Coat
    ctx.fillStyle = '#101024';
    ctx.fillRect(cx - 30, cy - 40, 60, 100);

    // Gold trim
    ctx.fillStyle = '#e2b714';
    ctx.fillRect(cx - 2, cy - 40, 4, 100);

    // Head / Top hat
    ctx.fillStyle = '#101024';
    ctx.fillRect(cx - 35, cy - 90, 70, 16); // Brim
    ctx.fillRect(cx - 25, cy - 140, 50, 50); // Crown

    // Face
    ctx.fillStyle = '#9e623b';
    ctx.fillRect(cx - 20, cy - 74, 40, 34);

    // Legs with stride
    ctx.fillStyle = '#5c2c1a'; // Boots
    // Left leg
    ctx.fillRect(cx - 20 + legSwing, cy + 60, 16, 50);
    // Right leg
    ctx.fillRect(cx + 4 - legSwing, cy + 60, 16, 50);

    // Frame label watermark for easy tracking
    ctx.font = '24px monospace';
    ctx.fillStyle = '#000';
    ctx.fillText(`FRAME ${i + 1}`, 24, 40);

    frames.push({
      index: i,
      timeSeconds: i * (1 / 12),
      canvas,
      dataUrl: canvas.toDataURL('image/png'),
    });
  }

  return frames;
}
