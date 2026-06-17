import { type DeviceClass, deviceScale } from "@/platform";
import { type QualityPref, type QualitySettings, resolveQuality } from "./quality";

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

// The player's quality preference ("auto" or a pinned tier), mirrored here from the store so the
// render bridge stays free of a state import (state→render is the allowed direction; not the
// reverse). App syncs it from settings at boot + on change via setQualityPref.
let pref: QualityPref = "auto";
/** Last measured FPS, retained so a pref change re-resolves with the same FPS evidence. */
let lastFps = 0;

// Resolve EAGERLY at module load (off the device class) so the first renderer to read
// getQuality() — GooCsg captures blobSegments in a mount-time useMemo, PostFX reads it on mount
// — already sees the correct device tier, not the desktop default. App still calls applyQuality
// in boot (+ an FPS monitor can call it to downgrade), but the eager value covers first paint.
let current: QualitySettings = resolveQuality(detectDeviceClass(), 0, pref);

/** Resolve + store the quality for the current device (optionally with a measured FPS to
 *  downgrade a struggling device). Honors the active pref ("auto" → device+FPS heuristic; a
 *  pinned tier → that tier). Returns the resolved settings. Call at boot, and again from an FPS
 *  monitor if frames sag. */
export function applyQuality(fps = 0): QualitySettings {
  lastFps = fps;
  current = resolveQuality(detectDeviceClass(), fps, pref);
  return current;
}

/** Set the player's quality preference (from settings) and re-resolve immediately, reusing the
 *  last measured FPS. Renderers that captured settings at mount (GooCsg's blobSegments useMemo)
 *  pick up the change on their next remount; per-frame readers (PostFX gating) see it at once. */
export function setQualityPref(next: QualityPref): QualitySettings {
  pref = next;
  current = resolveQuality(detectDeviceClass(), lastFps, pref);
  return current;
}

/** The active quality settings (read by renderers each frame / on mount). */
export function getQuality(): QualitySettings {
  return current;
}
