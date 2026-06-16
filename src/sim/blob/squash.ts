import { clamp } from "@/core/math";

/**
 * Squash-and-stretch model for the gooey blob (pure, deterministic). The blob stretches
 * along its velocity direction when moving fast and squashes flat on impact, then
 * springs back. Returns a non-uniform scale to apply to the blob mesh.
 *
 * Per the goo-techniques decision: scale-based deformation (cheap, great game-feel),
 * NOT vertex-distort materials.
 */

export interface SquashScale {
  x: number;
  y: number;
  z: number;
}

export interface SpeedStretchConfig {
  /** Speed at which stretch saturates. */
  maxSpeed: number;
  /** Max elongation along velocity (1.0 = +100%). */
  maxStretch: number;
}

export const DEFAULT_SPEED_STRETCH: SpeedStretchConfig = {
  maxSpeed: 30,
  maxStretch: 0.4,
};

/**
 * Velocity-driven stretch: elongate along the dominant axis of motion, conserving
 * volume by shrinking the other two axes. `vy` dominates (vertical launcher), but
 * lateral motion tilts the stretch too.
 */
export function speedStretch(
  vx: number,
  vy: number,
  vz: number,
  config: SpeedStretchConfig = DEFAULT_SPEED_STRETCH,
): SquashScale {
  const speed = Math.hypot(vx, vy, vz);
  const t = clamp(speed / config.maxSpeed, 0, 1);
  const stretch = t * config.maxStretch;

  // Vertical launcher: stretch primarily on Y. Volume-conserving: x,z shrink by ~half.
  const y = 1 + stretch;
  const xz = 1 - stretch * 0.5;
  return { x: xz, y, z: xz };
}

/**
 * Impact squash: a [0,1] impact amount flattens the blob on Y and bulges X/Z. Combine
 * (multiply) with speedStretch and a spring-back envelope for the full effect.
 */
export function impactSquash(amount: number, maxFlatten = 0.45): SquashScale {
  const a = clamp(amount, 0, 1);
  const flat = a * maxFlatten;
  return { x: 1 + flat * 0.6, y: 1 - flat, z: 1 + flat * 0.6 };
}

/** Multiply two scales component-wise (compose deformations). */
export function combineScale(a: SquashScale, b: SquashScale): SquashScale {
  return { x: a.x * b.x, y: a.y * b.y, z: a.z * b.z };
}
