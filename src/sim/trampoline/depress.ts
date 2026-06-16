import { type SpringState, stepSpring } from "@/core/math";
import type { TrampType } from "@/core/types";

/**
 * Trampoline depression + tilt model (pure). On impact the pad pushes DOWN (depress)
 * and tilts toward the hit point, then springs back — the `-k·x - c·v` spring from the
 * PoC. Drives both the visual mesh and the launch boost. Type behaviors differ:
 *   standard — reliable bounce
 *   booster  — extra rebound (1.8×)
 *   moving   — slides sideways (handled in the entity system, not here)
 *   fragile  — disintegrates shortly after impact
 */

export interface TrampState {
  depress: SpringState;
  tiltX: SpringState;
  tiltZ: SpringState;
}

export function createTrampState(): TrampState {
  return {
    depress: { value: 0, velocity: 0 },
    tiltX: { value: 0, velocity: 0 },
    tiltZ: { value: 0, velocity: 0 },
  };
}

const DEPRESS_SPRING = { stiffness: 170, damping: 26 };
const TILT_SPRING = { stiffness: 150, damping: 22 };

/** Per-type launch rebound multiplier. */
export const reboundMultiplier: Record<TrampType, number> = {
  standard: 1.12,
  booster: 1.8,
  moving: 1.05,
  fragile: 1.05,
};

/** Below this rebound speed (m/s) the pad does NOT bounce the blob — the goo settles into
 *  a resting puddle instead of jittering forever (and stops the runaway clean-combo). */
export const REBOUND_SETTLE_SPEED = 3.2;

/**
 * Compute the impulse the pad receives from an impact, as a target depress depth and
 * tilt (radians) toward the relative hit point on the pad surface ([-0.5,0.5] each axis).
 */
export function impactTargets(
  impactSpeed: number,
  relHitX: number,
  relHitZ: number,
): { depress: number; tiltX: number; tiltZ: number } {
  const force = Math.max(1.2, Math.min(5.5, Math.abs(impactSpeed) * 0.28));
  return {
    depress: -force * 0.98,
    tiltX: relHitZ * force * 0.38,
    tiltZ: -relHitX * force * 0.38,
  };
}

/**
 * Advance the trampoline springs one step toward the given targets. Returns the new
 * state; the caller applies it to the mesh (y offset + rotation).
 */
export function stepTramp(
  state: TrampState,
  targets: { depress: number; tiltX: number; tiltZ: number },
  dt: number,
): TrampState {
  return {
    depress: stepSpring(state.depress, targets.depress, DEPRESS_SPRING, dt),
    tiltX: stepSpring(state.tiltX, targets.tiltX, TILT_SPRING, dt),
    tiltZ: stepSpring(state.tiltZ, targets.tiltZ, TILT_SPRING, dt),
  };
}
