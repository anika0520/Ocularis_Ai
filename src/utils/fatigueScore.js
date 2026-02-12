// src/utils/fatigueScore.js
// Fatigue Score Calculation

export function calculateFatigue({ blinkRate, distance, tilt, dilation }) {
  let score = 0;

  if (blinkRate < 12) score += 20; // Adjusted threshold for realism
  if (distance < 50) score += 25;
  if (Math.abs(tilt) > 10) score += 20;
  if (dilation > 0.5) score += 25;

  return Math.min(100, score);
}
