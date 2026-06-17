import type { DeviceClass } from "@/platform";

/**
 * Quality tiers — one place that decides which render features run, so the heavy effects
 * (backbuffer goo refraction, depth-of-field, god rays, high bloom, big VFX pools, dense CSG)
 * are HIGH-tier only and never tax a mid/low device. Pure: `resolveQuality()` maps a device
 * class + a measured FPS into a tier + a flat settings object the renderers read; a small
 * runtime monitor can downgrade the tier if FPS sags. No DOM/three here.
 */

export type QualityTier = "low" | "medium" | "high";
/** Player-facing quality preference: "auto" lets the device class + FPS pick the tier (the
 *  default); the explicit tiers PIN the quality, overriding the heuristic (force Low to save
 *  battery, or force High on a device the heuristic under-rated). */
export type QualityPref = "auto" | QualityTier;

export interface QualitySettings {
  tier: QualityTier;
  /** Backbuffer refraction on the goo (MeshTransmission-style) — the marquee jelly look. */
  refraction: boolean;
  /** Depth-of-field focus pass. */
  dof: boolean;
  /** Volumetric god-ray pass (the sun sprite always shows; this is the shaft pass). */
  godRays: boolean;
  /** Bloom strength multiplier (0 = drop the pass entirely; renderers scale base bloom by this). */
  bloom: number;
  /** Chromatic-aberration pass (a cheap-but-not-free fringe; dropped on low). */
  chroma: boolean;
  /** Ambient-occlusion pass. */
  ao: boolean;
  /** Max simultaneous goo droplets / VFX pool size. */
  maxDroplets: number;
  /** CSG blob sphere segments (geometry density of the merged goo body). */
  blobSegments: number;
  /** Upper bound for the Canvas device-pixel-ratio (the renderer caps DPR at this). High-DPI
   *  phones pay quadratic fill cost, so mid/low clamp lower than a desktop. */
  maxDpr: number;
  /** MSAA on the default framebuffer (the Canvas antialias flag). Off on mid/low — bloom +
   *  the postfx grade hide most edge crawl, and MSAA is a real mobile fill cost. */
  antialias: boolean;
}

const LOW: QualitySettings = {
  tier: "low",
  refraction: false,
  dof: false,
  godRays: false,
  bloom: 0, // dropped entirely on low (strip the pass, not just soften it)
  chroma: false, // no chromatic-aberration fringe on low
  ao: false,
  maxDroplets: 18,
  blobSegments: 24,
  maxDpr: 1.5,
  antialias: false,
};

const MEDIUM: QualitySettings = {
  tier: "medium",
  refraction: false,
  dof: false,
  godRays: false,
  bloom: 1,
  chroma: true,
  ao: true,
  maxDroplets: 32,
  blobSegments: 32,
  maxDpr: 1.5,
  antialias: false,
};

const HIGH: QualitySettings = {
  tier: "high",
  refraction: true,
  dof: true,
  godRays: true,
  bloom: 1,
  chroma: true,
  ao: true,
  maxDroplets: 40,
  blobSegments: 40,
  maxDpr: 2,
  antialias: true,
};

const BY_TIER: Record<QualityTier, QualitySettings> = { low: LOW, medium: MEDIUM, high: HIGH };

/** The starting tier for a device class before any FPS evidence. Desktop → high, tablet →
 *  medium, phone → medium (phones with a coarse pointer are mid-tier by default; a sustained
 *  low FPS drops them to low at runtime). */
export function tierForDevice(device: DeviceClass): QualityTier {
  // Desktop starts high; tablet + phone start medium (a sustained low FPS drops them at runtime).
  return device === "desktop" ? "high" : "medium";
}

/**
 * Resolve the active quality settings from the device class and an optional measured FPS.
 * A sustained low FPS downgrades a tier (high→medium→low); a healthy FPS never upgrades past
 * the device's starting tier (so a fast phone doesn't get desktop-only heavy passes). FPS of
 * 0/undefined means "no measurement yet" → just the device tier.
 *
 * `pref` is the player's setting: "auto" (default) runs the device+FPS heuristic above; an
 * explicit tier PINS that tier and skips the heuristic entirely (manual override — force Low to
 * save battery, or force High on a capable device the heuristic under-rated).
 */
export function resolveQuality(
  device: DeviceClass,
  fps = 0,
  pref: QualityPref = "auto",
): QualitySettings {
  if (pref !== "auto") return BY_TIER[pref];
  let tier = tierForDevice(device);
  if (fps > 0) {
    if (fps < 30 && tier === "high") tier = "medium";
    if (fps < 24 && tier !== "low") tier = "low";
  }
  return BY_TIER[tier];
}

export { HIGH, LOW, MEDIUM };
