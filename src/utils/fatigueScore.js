// src/utils/fatigueScore.js
export function calculateFatigue({ blinkRate, distance, tilt, dilation }) {
  let score = 0;
  if (blinkRate < 12) score += 25;
  else if (blinkRate < 15) score += 10;
  if (distance < 40) score += 35;
  else if (distance < 50) score += 20;
  if (Math.abs(tilt) > 15) score += 20;
  else if (Math.abs(tilt) > 8) score += 10;
  if (dilation > 0.6) score += 20;
  else if (dilation > 0.5) score += 10;
  return Math.min(100, score);
}
