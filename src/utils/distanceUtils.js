// src/utils/distanceUtils.js
//
// How this works (pinhole camera model):
//   distance = (realIPD_mm * focalLength_px) / ipdPixels
//
// We don't know the camera's focal length in pixels, so we derive it
// from a one-time calibration. Until calibrated, we use a default
// focal length computed from a typical 640px wide webcam with ~70° FOV:
//   focalLength ≈ (imageWidth / 2) / tan(FOV/2)
//   focalLength ≈ (640 / 2) / tan(35°) ≈ 320 / 0.7002 ≈ 457 px
//
// realIPD average = 63mm
// So: defaultDistance = (63 * 457) / ipdPx

const DEFAULT_FOCAL_LENGTH_PX = 457; // for a ~70° FOV 640px-wide webcam
const REAL_IPD_MM = 63;              // average adult interpupillary distance

// focalLengthPx is computed once during calibration and stored externally.
// Until calibrated, pass null to use the default.
export function estimateDistance(ipdPixels, focalLengthPx = null) {
  if (!ipdPixels || ipdPixels < 2) return 60; // fallback if no face detected

  const fl = focalLengthPx ?? DEFAULT_FOCAL_LENGTH_PX;
  const distanceMm = (REAL_IPD_MM * fl) / ipdPixels;
  const distanceCm = distanceMm / 10;

  // Clamp to realistic range: 15cm (too close) to 200cm (too far)
  return Math.min(200, Math.max(15, distanceCm));
}

// Call this during calibration when user is at a known distance.
// Returns the focal length in pixels to store and reuse.
export function calibrateFocalLength(ipdPixels, knownDistanceCm) {
  if (!ipdPixels || ipdPixels < 2 || !knownDistanceCm) return DEFAULT_FOCAL_LENGTH_PX;
  // focalLength = (ipdPx * distance_mm) / realIPD_mm
  return (ipdPixels * knownDistanceCm * 10) / REAL_IPD_MM;
}