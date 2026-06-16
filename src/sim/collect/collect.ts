import type { Vec3 } from "@/core/types";

/**
 * Collection + magnet sim (pure). Determines which crystals the blob gathers this step
 * and how the magnet power-up pulls nearby crystals toward the blob. No DOM/three —
 * operates on plain positions so it's unit-testable and deterministic.
 */

export const PICKUP_RADIUS = 1.5;
export const MAGNET_RADIUS = 12;
export const MAGNET_PULL_SPEED = 14;

const dist = (a: Vec3, b: Vec3): number => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** Indices of crystals within pickup range of the blob this step. */
export function collectedIndices(blob: Vec3, crystals: readonly Vec3[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < crystals.length; i++) {
    if (dist(blob, crystals[i]) <= PICKUP_RADIUS) out.push(i);
  }
  return out;
}

/**
 * New position for a crystal under magnet attraction. Crystals within MAGNET_RADIUS are
 * pulled toward the blob at MAGNET_PULL_SPEED; others are unchanged.
 */
export function magnetStep(blob: Vec3, crystal: Vec3, dt: number): Vec3 {
  const d = dist(blob, crystal);
  if (d >= MAGNET_RADIUS || d === 0) return crystal;
  const step = Math.min(MAGNET_PULL_SPEED * dt, d);
  const t = step / d;
  return [
    crystal[0] + (blob[0] - crystal[0]) * t,
    crystal[1] + (blob[1] - crystal[1]) * t,
    crystal[2] + (blob[2] - crystal[2]) * t,
  ];
}
