// src/utils/lightUtils.js
//
// Samples brightness from the center of the VIDEO element (not the overlay canvas)
// by drawing a small patch of it into a temporary offscreen canvas.
// The overlay canvas only has mesh lines drawn on it, so sampling it gives wrong results.

export function estimateBrightness(videoElement) {
  if (!videoElement || videoElement.readyState < 2) return 0.5;

  try {
    const sampleSize = 40; // sample a 40x40 patch from the center
    const offscreen = document.createElement("canvas");
    offscreen.width = sampleSize;
    offscreen.height = sampleSize;
    const ctx = offscreen.getContext("2d", { willReadFrequently: true });

    // Draw center patch of video into offscreen canvas
    const vw = videoElement.videoWidth || 640;
    const vh = videoElement.videoHeight || 480;
    const cx = (vw - sampleSize) / 2;
    const cy = (vh - sampleSize) / 2;

    ctx.drawImage(videoElement, cx, cy, sampleSize, sampleSize, 0, 0, sampleSize, sampleSize);

    const imageData = ctx.getImageData(0, 0, sampleSize, sampleSize);
    const data = imageData.data;
    let sum = 0;
    const pixelCount = data.length / 4;

    for (let i = 0; i < data.length; i += 4) {
      // Weighted luminance: human eye is most sensitive to green
      sum += data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    }

    const avgLuminance = sum / pixelCount;
    return Math.max(0, Math.min(1, avgLuminance / 255));
  } catch {
    return 0.5;
  }
}