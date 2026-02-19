// src/utils/lightUtils.js
export function estimateBrightness(ctx) {
  try {
    const img = ctx.getImageData(0, 0, 20, 20);
    let sum = 0;
    for (let i = 0; i < img.data.length; i += 4) {
      sum += (img.data[i] + img.data[i + 1] + img.data[i + 2]) / 3;
    }
    return sum / (img.data.length / 4) / 255;
  } catch {
    return 0.5;
  }
}
