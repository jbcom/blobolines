import { type DeviceClass, deviceScale } from "@/platform";
import { type QualitySettings, resolveQuality } from "./quality";

/**
 * Runtime holder for the active QualitySettings, so the R3F renderers (PostFX, GooCsg, the
 * droplet pool, and the HIGH-tier-only effects) can read the current tier imperatively without
 * threading it through props or re-rendering. Resolved once at boot from the device class;
 * `applyQuality()` can be called again to re-resolve with a measured FPS to downgrade.
 */

let current: QualitySettings = resolveQuality("desktop");

/** Detect the device class from the viewport (reuse deviceScale's classifier). */
function detectDeviceClass(): DeviceClass {
  if (typeof window === "undefined") return "desktop";
  const minDim = Math.min(window.innerWidth, window.innerHeight);
  const coarsePointer =
    typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
  return deviceScale({ minDim, coarsePointer }).deviceClass;
}

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
