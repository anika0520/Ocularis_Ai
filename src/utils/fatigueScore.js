// src/utils/fatigueScore.js
//
// Changes from original:
// 1. Dilation thresholds fixed — raw iris/eye ratio in normalized coords
//    lands around 0.15–0.35, not 0.5–0.6. Thresholds updated accordingly.
// 2. Session duration now contributes — eyes naturally fatigue over time.
// 3. Score is smoothed with EMA (exponential moving average) across calls
//    so it doesn't jump wildly frame to frame.
// 4. Tilt contribution made more lenient — slight head tilt is normal.

let _smoothedScore = 0; // EMA state — persists across calls within a session

export function resetFatigueSmoothing() {
  _smoothedScore = 0;
}

export function calculateFatigue({ blinkRate, distance, tilt, dilation, sessionSeconds = 0 }) {
  let raw = 0;

  // ── Blink rate (0–30 points) ───────────────────────────────────────
  // Healthy: 15–20 bpm. Below 10 is a real concern.
  if (blinkRate === 0) {
    // No blinks yet — don't penalize, just neutral
    raw += 0;
  } else if (blinkRate < 8) {
    raw += 30;
  } else if (blinkRate < 12) {
    raw += 18;
  } else if (blinkRate < 15) {
    raw += 8;
  }

  // ── Screen distance (0–35 points) ─────────────────────────────────
  if (distance < 35) {
    raw += 35;
  } else if (distance < 45) {
    raw += 22;
  } else if (distance < 50) {
    raw += 12;
  } else if (distance > 90) {
    raw += 8; // squinting from too far also causes strain
  }

  // ── Head tilt (0–15 points) ────────────────────────────────────────
  // Slight tilt is normal posture. Only flag significant sustained tilt.
  const absTilt = Math.abs(tilt);
  if (absTilt > 20) {
    raw += 15;
  } else if (absTilt > 12) {
    raw += 8;
  }

  // ── Pupil dilation proxy (0–20 points) ────────────────────────────
  // dilation = iris_diameter_normalized / eye_openness_normalized
  // Typical resting value: ~0.15–0.25
  // High dilation (stress/strain): > 0.30
  // Low dilation (bright env): < 0.12
  if (dilation > 0.32) {
    raw += 20; // high cognitive/visual load
  } else if (dilation > 0.27) {
    raw += 10;
  } else if (dilation < 0.10) {
    raw += 5; // very low — possibly very bright/strained squinting
  }

  // ── Session duration fatigue (0–20 points) ─────────────────────────
  // Eyes naturally fatigue regardless of other factors.
  // After 30 min: mild. After 60 min: moderate. After 90 min: significant.
  if (sessionSeconds > 5400) {      // 90+ minutes
    raw += 20;
  } else if (sessionSeconds > 3600) { // 60–90 min
    raw += 13;
  } else if (sessionSeconds > 1800) { // 30–60 min
    raw += 6;
  }

  const clampedRaw = Math.min(100, Math.max(0, raw));

  // ── EMA smoothing (α = 0.15 → slow, stable changes) ──────────────
  // Prevents the gauge from jumping every frame.
  const alpha = 0.15;
  _smoothedScore = alpha * clampedRaw + (1 - alpha) * _smoothedScore;

  return Math.round(_smoothedScore);
}