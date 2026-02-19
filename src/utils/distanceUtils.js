// src/utils/distanceUtils.js
export function estimateDistance(baseIPD, ipdPixels) {
  if (!ipdPixels || ipdPixels < 1) return 60;
  return Math.min(200, Math.max(20, (baseIPD / ipdPixels) * 50));
}
