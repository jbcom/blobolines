import { trampoline as trampCfg } from "@/config";
import type { GoldenPathProof, TrampolineSpec, Vec3 } from "@/core/types";
import { GRAVITY } from "@/sim/physics";

/**
 * Pure reachability check for the golden-path guarantee: can a blob bounced off pad A
 * (launched along A's surface normal at `speed`) reach pad B? Ballistic model under gravity
 * g (>0 magnitude): from A's top, the launch reaches at least B's height with enough lateral
 * travel to land within B's footprint. A flat pad (up normal) only covers lateral distance
 * via residual drift, so a far B needs A canted — exactly what the generator guarantees.
 *
 * Conservative: treats the blob as a point. The shipped golden path ignores air-steer so the
 * dev harness can draw the exact parabola it proves; air-steer remains extra player agency.
 */

/** Surface normal of a pad: its `cant` tilted, else straight up. Mirrors cantNormal but
 *  kept local + dependency-free so this stays a pure world-gen helper. */
type SourceMode = GoldenPathProof["sourceMode"];

function unitToward(a: TrampolineSpec, b: TrampolineSpec): readonly [number, number] {
  const dx = b.position[0] - a.position[0];
  const dz = b.position[2] - a.position[2];
  const m = Math.hypot(dx, dz);
  return m < 1e-6 ? [1, 0] : [dx / m, dz / m];
}

function unit2(v: readonly [number, number] | undefined): readonly [number, number] {
  if (!v) return [0, 0];
  const m = Math.hypot(v[0], v[1]);
  return m < 1e-6 ? [0, 0] : [v[0] / m, v[1] / m];
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function inferredMode(pad: TrampolineSpec): SourceMode {
  if (pad.type === "canted") return "canted";
  if (pad.type === "moving") return "moving";
  if (pad.type === "wobbler") return "wobbler";
  return "flat";
}

function sourceNormal(
  pad: TrampolineSpec,
  target: TrampolineSpec,
  tiltRad: number,
  mode: SourceMode = inferredMode(pad),
): Vec3 {
  if (mode === "flat") return [0, 1, 0];

  if (mode === "moving") {
    const [mx, mz] = unit2(pad.moveAxis ?? unitToward(pad, target));
    const lateral = Math.min(0.5, (trampCfg.movingAmplitude * trampCfg.movingSpeed) / 12);
    return [lateral * mx, Math.sqrt(Math.max(0.01, 1 - lateral * lateral)), lateral * mz];
  }

  if (mode === "wobbler") {
    const [wx, wz] = unitToward(pad, target);
    const lateral = Math.sin(trampCfg.wobblerMaxTiltRad);
    return [lateral * wx, Math.sqrt(Math.max(0.01, 1 - lateral * lateral)), lateral * wz];
  }

  const [cx, cz] = unit2(pad.cant ?? unitToward(pad, target));
  const m = Math.hypot(cx, cz) || 1;
  const tilt = pad.cantAngleRad ?? tiltRad;
  const s = Math.sin(tilt);
  return [(s * cx) / m, Math.cos(tilt), (s * cz) / m];
}

/**
 * Can a launch off `a` reach `b`? `speed` is the rebound launch speed, `g` gravity magnitude,
 * `tiltRad` the canted tilt, `airSteerAccel` the lateral acceleration the player can apply
 * mid-air. This remains available for balance experiments, but the shipped golden path uses
 * solveGoldenPath() instead so the certified route can be drawn as a true parabola.
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
  const n = sourceNormal(a, b, tiltRad);
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

/** Ballistic position at time `t` from `origin`, `velocity`, and gravity magnitude `g`. */
function trajectoryPoint(origin: Vec3, velocity: Vec3, g: number, t: number): Vec3 {
  return [
    origin[0] + velocity[0] * t,
    origin[1] + velocity[1] * t - 0.5 * g * t * t,
    origin[2] + velocity[2] * t,
  ];
}

const SAMPLE_COUNT = 24;
const PAD_SURFACE_Y = 0.72;

/**
 * Construct the actual passive golden-path parabola from `a` to `b`, or null if the launch
 * does not land inside B's footprint. Unlike canReach(..., airSteer), this is a visible,
 * screenshotable route: the generated samples are the route the dev harness draws in red.
 */
export function solveGoldenPath(
  a: TrampolineSpec,
  b: TrampolineSpec,
  speed = CLIMB_SPEED,
  g = G,
  tiltRad = TILT,
  requiredCant = a.type === "canted",
  sourceMode = inferredMode(a),
): GoldenPathProof | null {
  const n = sourceNormal(a, b, tiltRad, sourceMode);
  const velocity: Vec3 = [n[0] * speed, n[1] * speed, n[2] * speed];
  const origin: Vec3 = [a.position[0], a.position[1] + PAD_SURFACE_Y, a.position[2]];
  const targetY = b.position[1] + PAD_SURFACE_Y;
  const dy = targetY - origin[1];

  if (velocity[1] * velocity[1] < 2 * g * dy) return null;
  const disc = velocity[1] * velocity[1] - 2 * g * dy;
  const flightTime = Math.max(0, (velocity[1] - Math.sqrt(Math.max(0, disc))) / g);
  const landing = trajectoryPoint(origin, velocity, g, flightTime);
  const miss = Math.hypot(landing[0] - b.position[0], landing[2] - b.position[2]);
  const halfFoot = Math.max(b.width, b.depth) * 0.5;
  const clearance = halfFoot - miss;
  if (clearance < 0) return null;

  const apexTime = Math.max(0, Math.min(flightTime, velocity[1] / g));
  const apex = trajectoryPoint(origin, velocity, g, apexTime);
  const lipClearanceRatio = halfFoot > 0 ? clearance / halfFoot : 0;
  const landingPrecision = halfFoot > 0 ? clamp01(1 - miss / halfFoot) : 1;
  const apexClearance = Math.max(0, apex[1] - targetY);
  const peakBudget = Math.max(1, (velocity[1] * velocity[1]) / (2 * g));
  const arcCompression = clamp01(1 - apexClearance / peakBudget);
  const launchAngleRad = Math.acos(Math.min(1, Math.max(-1, n[1])));
  const samples: Vec3[] = [];
  for (let i = 0; i <= SAMPLE_COUNT; i++) {
    const t = flightTime * (i / SAMPLE_COUNT);
    samples.push(trajectoryPoint(origin, velocity, g, t));
  }
  return {
    toPadId: b.id,
    launchNormal: n,
    launchSpeed: speed,
    flightTime,
    apex,
    landing,
    clearance,
    samples,
    requiredCant,
    sourceMode,
    launchAngleRad,
    landingPrecision,
    lipClearance: clearance,
    lipClearanceRatio,
    arcCompression,
  };
}

/**
 * Climb-tuning constants — the single source of truth the world generator and the climb proof
 * (reachable.test.ts) both use, so the placement rule and the playability check can never
 * drift apart. A sustained clean climb keeps the blob launching at ~CLIMB_SPEED; canted pads
 * use the configured tilt; the golden route itself is a visible passive parabola.
 */
export const CLIMB_SPEED = 30;
const G = Math.abs(GRAVITY[1]);
const TILT = trampCfg.cantedTiltRad;

/**
 * Golden-path predicate: can the blob get from pad `a` to pad `b` under the shipped launch
 * speed, gravity, and canted tilt as a passive visible parabola? The generator attaches that
 * full proof to every source pad.
 */
export function reaches(a: TrampolineSpec, b: TrampolineSpec): boolean {
  return solveGoldenPath(a, b) !== null;
}
