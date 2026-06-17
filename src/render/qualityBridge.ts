import { type DeviceClass, deviceScale } from "@/platform";
import { type QualitySettings, resolveQuality } from "./quality";

/**
 * Runtime holder for the active QualitySettings, so the R3F renderers (PostFX, GooCsg, the
 * droplet pool, and the HIGH-tier-only effects) can read the current tier imperatively without
 * threading it through props or re-rendering. Resolved once at boot from the device class;
 * `applyQuality()` can be called again to re-resolve with a measured FPS to downgrade.
 */

/** Detect the device class from the viewport (reuse deviceScale's classifier). */
function detectDeviceClass(): DeviceClass {
  if (typeof window === "undefined") return "desktop";
  const minDim = Math.min(window.innerWidth, window.innerHeight);
  const coarsePointer =
    typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
  return deviceScale({ minDim, coarsePointer }).deviceClass;
}

// Resolve EAGERLY at module load (off the device class) so the first renderer to read
// getQuality() — GooCsg captures blobSegments in a mount-time useMemo, PostFX reads it on mount
// — already sees the correct device tier, not the desktop default. App still calls applyQuality
// in boot (+ an FPS monitor can call it to downgrade), but the eager value covers first paint.
let current: QualitySettings = resolveQuality(detectDeviceClass());

/** Resolve + store the quality for the current device (optionally with a measured FPS to
 *  downgrade a struggling device). Returns the resolved settings. Call at boot, and again from
 *  an FPS monitor if frames sag. */
export function applyQuality(fps = 0): QualitySettings {
  current = resolveQuality(detectDeviceClass(), fps);
  return current;
}

/** The active quality settings (read by renderers each frame / on mount). */
export function getQuality(): QualitySettings {
  return current;
}
