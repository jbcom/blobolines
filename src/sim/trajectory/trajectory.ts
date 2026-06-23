/**
 * Predicted-trajectory projection — pure, deterministic, no DOM/three.
 *
 * The air-aim arc must show WHERE THE BLOB IS HEADING (the player's words), so the renderer draws
 * exactly this: the blob's current position + velocity, forward-integrated under gravity plus the
 * lateral steering acceleration the player is currently applying. What you see is what the physics
 * will do — not an abstract drag indicator.
 *
 * The integration mirrors PlayerBlob's air step: semi-implicit Euler with `v += (gravity + steer)·dt`
 * then `p += v·dt`. Steering is a lateral (X/Z) acceleration just like getAirSteer() feeds the body.
 */

export interface TrajectoryInput {
  /** Current blob world position. */
  position: readonly [number, number, number];
  /** Current blob world velocity. */
  velocity: readonly [number, number, number];
  /** Lateral steering acceleration the player is applying right now (world X/Z), m/s². */
  steer: readonly [number, number];
  /** Gravity vector (y negative), m/s². */
  gravity: readonly [number, number, number];
}

export interface TrajectoryOptions {
  /** Integration step, seconds. Smaller = smoother curve, more points. */
  step?: number;
  /** Max points to emit (caps cost on long arcs). */
  maxPoints?: number;
  /** Stop once the path descends this far below the start Y (we only care about the up-and-over). */
  maxDrop?: number;
}

/**
 * Forward-integrate the blob's path and return the sampled world-space points. The arc ends when
 * it has fallen `maxDrop` below the launch height or hits `maxPoints` — enough to read the apex and
 * the descending side toward the next pad without projecting an endless fall.
 */
/**
 * Whether the mid-air lateral SETTLE should engage this frame. The settle tidies steering-induced
 * drift so the arc can ease back to the middle of its range — but it must NOT bleed the lateral
 * travel of a purely BALLISTIC certified hop, or a hands-off flat-pad offset launch could undershoot
 * its target (breaking the climb-reach guarantee in src/world/reachable). So it engages only when
 * the player is hands-off NOW *and* has steered at least once during the current flight.
 */
export function shouldSettleLateral(steeringNow: boolean, steeredThisFlight: boolean): boolean {
  return !steeringNow && steeredThisFlight;
}

export function projectTrajectory(
  input: TrajectoryInput,
  options: TrajectoryOptions = {},
): Array<[number, number, number]> {
  // Clamp degenerate options so a bad step/cap can never produce a runaway loop or violate the
  // documented point-cap (step ≤ 0 would never advance; maxPoints < 1 would skip even the start).
  const rawStep = options.step ?? 0.05;
  const step = rawStep > 0 ? rawStep : 0.05;
  const maxPoints = Math.max(1, Math.floor(options.maxPoints ?? 64));
  const maxDrop = Math.max(0, options.maxDrop ?? 60);

  const [gx, gy, gz] = input.gravity;
  const [sx, sz] = input.steer;
  let [px, py, pz] = input.position;
  let [vx, vy, vz] = input.velocity;
  const startY = py;

  const points: Array<[number, number, number]> = [[px, py, pz]];
  for (let i = 1; i < maxPoints; i++) {
    vx += (gx + sx) * step;
    vy += gy * step;
    vz += (gz + sz) * step;
    px += vx * step;
    py += vy * step;
    pz += vz * step;
    points.push([px, py, pz]);
    if (startY - py > maxDrop) break;
  }
  return points;
}
