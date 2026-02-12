// src/utils/distanceUtils.js
// Screen distance estimation

export function estimateDistance(baseIPD, ipdPixels) {
  if (!ipdPixels) return 60;

  return (baseIPD / ipdPixels) * 50;
}
