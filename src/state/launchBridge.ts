/**
 * Input bridge — a tiny imperative channel from the DOM/keyboard input layer to the
 * physics blob. The overlay stores the latest launch (dir + charge) on slingshot
 * release (last-write-wins, consumed once next frame); the air-steer force is a
 * continuous X/Z value the blob reads each frame while airborne. Avoids threading refs
 * through the React tree while keeping UI and physics decoupled.
 */

export interface LaunchRequest {
  dir: readonly [number, number, number];
  charge: number;
}

let pending: LaunchRequest | null = null;

export function requestLaunch(req: LaunchRequest): void {
  pending = req;
}

/** Consume the pending launch (returns it once, then clears). */
export function consumeLaunch(): LaunchRequest | null {
  const r = pending;
  pending = null;
  return r;
}

/** Continuous mid-air steering force on the world X/Z plane (lateral accel). */
let steer: readonly [number, number] = [0, 0];

export function setAirSteer(x: number, z: number): void {
  steer = [x, z];
}

export function getAirSteer(): readonly [number, number] {
  return steer;
}

/** Latest landing impact speed, reported by a trampoline, consumed once by the blob. */
let landingImpact = 0;

export function reportImpact(speed: number): void {
  landingImpact = Math.max(landingImpact, speed);
}

/** Consume the pending landing impact speed (returns it once, then clears). */
export function consumeImpact(): number {
  const s = landingImpact;
  landingImpact = 0;
  return s;
}

/** A pending trampoline rebound: the upward speed to bounce the blob at, plus the pad
 *  type (for combo/scoring). Reported by a trampoline on contact, consumed by the blob. */
export interface ReboundRequest {
  speed: number;
  type: string;
}

let rebound: ReboundRequest | null = null;

export function reportRebound(req: ReboundRequest): void {
  // Keep the strongest pending rebound if several pads are touched in one frame.
  if (!rebound || req.speed > rebound.speed) rebound = req;
}

export function consumeRebound(): ReboundRequest | null {
  const r = rebound;
  rebound = null;
  return r;
}
