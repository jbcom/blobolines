/**
 * Launch bridge — a tiny imperative channel from the DOM input layer to the physics
 * blob. The overlay computes an aim (direction + charge) on pointer release and queues
 * a launch; PlayerBlob consumes it on the next frame and applies the impulse. Avoids
 * threading refs through the React tree while keeping UI and physics decoupled.
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
