import type { Rng } from "@/core/math";
import type { TrampolineSpec, Vec3 } from "@/core/types";

/**
 * Off-route bounce obstacles — a NEW interaction class (see directive N19): a solid object the
 * blob ricochets off, distinct from landing pads (targets), route gates (pass-through triggers),
 * crystals/power-ups (collectibles), and hazards (force fields). They are purely OPTIONAL scenery
 * with mass — never a failure state, never on the certified climb route.
 *
 * The hard invariant (see [[blobolines-reachability-invariant]]): an obstacle must NEVER sit on or
 * near the certified golden path, or it would block a proven pad-to-pad reach and break
 * climbability. `reaches()`/the golden proofs stay the single source of truth — this module does
 * not re-derive reach math; it READS the proofs' sampled arcs and keeps every obstacle a safe
 * distance from all of them (and from pad footprints). Pure + seeded: same pads + seed → same
 * obstacles.
 */

export interface ObstacleSpec {
  /** Stable id (its generation Y), mirroring the pad id scheme so render windows can key by it. */
  id: number;
  /** World position of the obstacle's bob CENTER (the rest position it oscillates around). */
  position: Vec3;
  /** Collision/visual radius (a sphere — simple, predictable bounce). */
  radius: number;
  /** Gentle VERTICAL bob so an obstacle drifts up/down rather than sitting dead-still — more alive,
   *  and a slightly trickier (but still optional) bounce. The bob is on the Y axis ONLY and its full
   *  travel (`position.y ± amplitude`) is verified clear of the golden route at generation time, so a
   *  bobbing obstacle can NEVER drift into the climb corridor (the reachability invariant holds across
   *  the whole oscillation). Horizontal position never changes — only vertical, only within amplitude. */
  bob: { amplitude: number; speed: number; phase: number };
}

/** Clearance (world units) every obstacle keeps from any golden-arc sample point — the blob's
 *  flight corridor. An obstacle's surface must stay outside this radius from the route line so a
 *  certified launch can never clip it. = blob radius + arc sample spacing slop + obstacle radius
 *  margin; generous on purpose (a false-positive rejection just drops one obstacle, harmless). */
export const ROUTE_CLEARANCE = 6.5;
/** Extra clearance an obstacle keeps from any pad's footprint center, so it never crowds a pad. */
export const PAD_CLEARANCE = 7.0;
/** Min separation between two obstacles so they don't visually merge / double-bounce. */
const OBSTACLE_SEPARATION = 8.0;
/** Obstacle sphere radius range. */
const MIN_RADIUS = 1.4;
const MAX_RADIUS = 2.6;
/** Vertical bob amplitude range (world units) — kept small so the full travel still fits in the
 *  off-route negative space and the bounce stays predictable. */
const MIN_BOB = 0.6;
const MAX_BOB = 2.2;
/** Bob speed range (radians/sec for the sine). */
const MIN_BOB_SPEED = 0.5;
const MAX_BOB_SPEED = 1.1;
/** At most this many obstacles per pad considered — keeps density sane + the count bounded. */
const SPAWN_CHANCE = 0.5;
/** Lateral offset range from a pad, out into the negative space beside the route. */
const MIN_OFFSET = 11;
const MAX_OFFSET = 20;

/** Squared horizontal+vertical distance between two points (full 3D). */
function dist2(a: Vec3, b: Vec3): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];
  return dx * dx + dy * dy + dz * dz;
}

/**
 * Is `p` clear of every certified golden-arc sample by at least ROUTE_CLEARANCE? This is the
 * climbability guard: the golden samples ARE the flight corridor, so keeping obstacles outside a
 * tube around them guarantees no obstacle can block a proven reach. Only nearby pads' arcs are
 * checked (the caller passes the local pad slice), which is sufficient since arcs are local.
 */
export function clearOfRoute(
  p: Vec3,
  pads: readonly TrampolineSpec[],
  clearance = ROUTE_CLEARANCE,
) {
  const c2 = clearance * clearance;
  for (const pad of pads) {
    const proof = pad.goldenPath;
    if (!proof) continue;
    for (const s of proof.samples) {
      if (dist2(p, s) < c2) return false;
    }
  }
  return true;
}

/** Is `p` clear of every pad footprint center by PAD_CLEARANCE (+ the pad's own half-extent)? */
function clearOfPads(p: Vec3, pads: readonly TrampolineSpec[]): boolean {
  for (const pad of pads) {
    const half = Math.max(pad.width, pad.depth) * 0.5;
    const need = PAD_CLEARANCE + half;
    if (dist2(p, pad.position) < need * need) return false;
  }
  return true;
}

/**
 * Place off-route bounce obstacles for the pads in [fromY, toY). Pure + seeded. Each candidate is
 * offset laterally from a pad into the negative space, then accepted ONLY if it clears every golden
 * arc, every pad footprint, and every already-placed obstacle. A rejected candidate is simply
 * dropped (no retry storm) — obstacles are optional, so sparse-but-safe beats dense-but-risky.
 */
export function generateObstacles(
  rng: Rng,
  pads: readonly TrampolineSpec[],
  fromY: number,
  toY: number,
): ObstacleSpec[] {
  const out: ObstacleSpec[] = [];
  for (const pad of pads) {
    const py = pad.position[1];
    if (py < fromY || py >= toY) continue;
    if (rng.next() > SPAWN_CHANCE) continue;

    // Offset out to one side of the route, on the X/Z plane, at roughly the pad's height.
    const angle = rng.next() * Math.PI * 2;
    const offset = MIN_OFFSET + rng.next() * (MAX_OFFSET - MIN_OFFSET);
    const radius = MIN_RADIUS + rng.next() * (MAX_RADIUS - MIN_RADIUS);
    const cx = pad.position[0] + Math.cos(angle) * offset;
    const cy = py + (rng.next() - 0.5) * 6; // bob-center Y; jitter so they don't band at pad heights
    const cz = pad.position[2] + Math.sin(angle) * offset;
    const candidate: Vec3 = [cx, cy, cz];
    const amplitude = MIN_BOB + rng.next() * (MAX_BOB - MIN_BOB);

    // Clear the WHOLE bob travel from the route: the center AND both vertical extremes
    // (cy ± amplitude) must stay outside the corridor, so the obstacle can never drift into a
    // certified reach over its oscillation. (Pad/obstacle spacing checks the center — pads are wide
    // and the bob is small, so the small vertical wiggle can't crowd a pad it already cleared.)
    const top: Vec3 = [cx, cy + amplitude, cz];
    const bottom: Vec3 = [cx, cy - amplitude, cz];
    if (!clearOfRoute(candidate, pads)) continue;
    if (!clearOfRoute(top, pads) || !clearOfRoute(bottom, pads)) continue;
    if (!clearOfPads(candidate, pads)) continue;
    // Keep obstacles apart from each other.
    const sep2 = OBSTACLE_SEPARATION * OBSTACLE_SEPARATION;
    if (out.some((o) => dist2(o.position, candidate) < sep2)) continue;

    out.push({
      id: py,
      position: candidate,
      radius,
      bob: {
        amplitude,
        speed: MIN_BOB_SPEED + rng.next() * (MAX_BOB_SPEED - MIN_BOB_SPEED),
        phase: rng.next() * Math.PI * 2,
      },
    });
  }
  return out;
}
