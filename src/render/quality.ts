import type { DeviceClass } from "@/platform";

/**
 * Quality tiers — one place that decides which render features run, so the heavy effects
 * (backbuffer goo refraction, depth-of-field, god rays, high bloom, big VFX pools, dense CSG)
 * are HIGH-tier only and never tax a mid/low device. Pure: `resolveQuality()` maps a device
 * class + a measured FPS into a tier + a flat settings object the renderers read; a small
 * runtime monitor can downgrade the tier if FPS sags. No DOM/three here.
 */

export type QualityTier = "low" | "medium" | "high";

export interface QualitySettings {
  tier: QualityTier;
  /** Backbuffer refraction on the goo (MeshTransmission-style) — the marquee jelly look. */
  refraction: boolean;
  /** Depth-of-field focus pass. */
  dof: boolean;
  /** Volumetric god-ray pass (the sun sprite always shows; this is the shaft pass). */
  godRays: boolean;
  /** Bloom strength multiplier (0 disables; renderers scale their base bloom by this). */
  bloom: number;
  /** Ambient-occlusion pass. */
  ao: boolean;
  /** Max simultaneous goo droplets / VFX pool size. */
  maxDroplets: number;
  /** CSG blob sphere segments (geometry density of the merged goo body). */
  blobSegments: number;
}

const LOW: QualitySettings = {
  tier: "low",
  refraction: false,
  dof: false,
  godRays: false,
  bloom: 0.6,
  ao: false,
  maxDroplets: 18,
  blobSegments: 24,
};

const MEDIUM: QualitySettings = {
  tier: "medium",
  refraction: false,
  dof: false,
  godRays: false,
  bloom: 1,
  ao: true,
  maxDroplets: 32,
  blobSegments: 32,
};

const HIGH: QualitySettings = {
  tier: "high",
  refraction: true,
  dof: true,
  godRays: true,
  bloom: 1,
  ao: true,
  maxDroplets: 40,
  blobSegments: 40,
};

const BY_TIER: Record<QualityTier, QualitySettings> = { low: LOW, medium: MEDIUM, high: HIGH };

/** The starting tier for a device class before any FPS evidence. Desktop → high, tablet →
 *  medium, phone → medium (phones with a coarse pointer are mid-tier by default; a sustained
 *  low FPS drops them to low at runtime). */
export function tierForDevice(device: DeviceClass): QualityTier {
  if (device === "desktop") return "high";
  if (device === "tablet") return "medium";
  return "medium";
}

/**
 * Resolve the active quality settings from the device class and an optional measured FPS.
 * A sustained low FPS downgrades a tier (high→medium→low); a healthy FPS never upgrades past
 * the device's starting tier (so a fast phone doesn't get desktop-only heavy passes). FPS of
 * 0/undefined means "no measurement yet" → just the device tier.
 */
export function resolveQuality(device: DeviceClass, fps = 0): QualitySettings {
  let tier = tierForDevice(device);
  if (fps > 0) {
    if (fps < 30 && tier === "high") tier = "medium";
    if (fps < 24 && tier !== "low") tier = "low";
  }
  return BY_TIER[tier];
}

export { HIGH, LOW, MEDIUM };
