// src/utils/blinkUtils.js
// Calculate Eye Aspect Ratio (EAR)

export function getEAR(points) {
  if (points.some((p) => !p)) return 0.3;

  const d1 = Math.hypot(points[1].x - points[5].x, points[1].y - points[5].y);

  const d2 = Math.hypot(points[2].x - points[4].x, points[2].y - points[4].y);

  const d3 = Math.hypot(points[0].x - points[3].x, points[0].y - points[3].y);

  return (d1 + d2) / (2 * d3 || 1);
}
