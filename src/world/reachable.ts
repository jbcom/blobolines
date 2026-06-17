import { trampoline as trampCfg } from "@/config";
import type { TrampolineSpec, Vec3 } from "@/core/types";
import { DEFAULT_STEER } from "@/input";
import { GRAVITY } from "@/sim/physics";

/**
 * Pure reachability check for the golden-path guarantee: can a blob bounced off pad A
 * (launched along A's surface normal at `speed`) reach pad B? Ballistic model under gravity
 * g (>0 magnitude): from A's top, the launch reaches at least B's height with enough lateral
 * travel to land within B's footprint. A flat pad (up normal) only covers lateral distance
 * via residual drift, so a far B needs A canted — exactly what the generator guarantees.
 *
 * Conservative: treats the blob as a point, ignores air-steer (which only helps), so a pass
 * here means reachable even for a passive player.
 */

/** Surface normal of a pad: its `cant` tilted, else straight up. Mirrors cantNormal but
 *  kept local + dependency-free so this stays a pure world-gen helper. */
function padNormal(pad: TrampolineSpec, tiltRad: number): Vec3 {
  if (pad.type !== "canted" || !pad.cant) return [0, 1, 0];
  const [cx, cz] = pad.cant;
  const m = Math.hypot(cx, cz) || 1;
  const s = Math.sin(tiltRad);
  return [(s * cx) / m, Math.cos(tiltRad), (s * cz) / m];
}

/**
 * Can a launch off `a` reach `b`? `speed` is the rebound launch speed, `g` gravity magnitude,
 * `tiltRad` the canted tilt, `airSteerAccel` the lateral acceleration the player can apply
 * mid-air (the documented air-control mechanic the golden-path relies on for sub-cant gaps;
 * pass 0 for a pure-passive ballistic check).
 *
 * Returns true if the ballistic arc clears B's height AND, by the time it reaches that
 * height, the launch's lateral reach PLUS the air-steer budget covers the lateral gap to B
 * (minus B's half-footprint, since landing anywhere on B counts).
 */
export function canReach(
  a: TrampolineSpec,
  b: TrampolineSpec,
  speed: number,
  g: number,
  tiltRad: number,
  airSteerAccel = 0,
): boolean {
  const n = padNormal(a, tiltRad);
  const vy = n[1] * speed;
  const dy = b.position[1] - a.position[1];
  // Peak height reached: vy²/2g. Must clear the vertical gap to B.
  if (vy * vy < 2 * g * dy) return false;
  // Time to FIRST reach B's height: the smaller root of dy = vy·t − ½g·t². When B is above A
  // (dy>0, the climbing case) that's the ascending crossing. When B is at or below A (dy≤0)
  // the small root is non-positive — the blob is already at/over B's height at launch — so
  // clamp to t=0 (no time to drift laterally; only an essentially-overhead B is reachable).
  const disc = vy * vy - 2 * g * dy;
  const t = Math.max(0, (vy - Math.sqrt(Math.max(0, disc))) / g);
  // Horizontal reach from the launch normal in that time...
  const reachX = n[0] * speed * t;
  const reachZ = n[2] * speed * t;
  const gapX = b.position[0] - a.position[0];
  const gapZ = b.position[2] - a.position[2];
  // Residual miss after the ballistic reach, vs B's half-footprint plus the lateral distance
  // the player can steer in flight (½·a·t² — bounded mid-air control closes sub-cant gaps).
  const miss = Math.hypot(gapX - reachX, gapZ - reachZ);
  const halfFoot = Math.max(b.width, b.depth) * 0.5;
  const steerReach = 0.5 * airSteerAccel * t * t;
  return miss <= halfFoot + steerReach;
}

/**
 * Climb-tuning constants — the single source of truth the world generator and the climb proof
 * (reachable.test.ts) both use, so the placement rule and the playability check can never
 * drift apart. A sustained clean climb keeps the blob launching at ~CLIMB_SPEED; the player
 * gets DEFAULT_STEER's lateral budget in flight; canted pads use the configured tilt.
 */
export const CLIMB_SPEED = 30;
const G = Math.abs(GRAVITY[1]);
const TILT = trampCfg.cantedTiltRad;
const STEER = DEFAULT_STEER.maxAirAccel;

/**
 * Golden-path predicate: can the blob get from pad `a` to pad `b` under the shipped tuning
 * (launch speed, gravity, canted tilt, and the player's mid-air steer budget)? The generator
 * cants a pad whenever its flat self FAILS this for its successor; the climb proof asserts it
 * holds for every consecutive pair.
 */
export function reaches(a: TrampolineSpec, b: TrampolineSpec): boolean {
  return canReach(a, b, CLIMB_SPEED, G, TILT, STEER);
}
