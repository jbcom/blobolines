import { launch as launchCfg, trampoline as trampCfg } from "@/config";
import type { GoldenPathProof, TrampolineSpec, Vec3 } from "@/core/types";
import { GRAVITY } from "@/sim/physics";

/**
 * Pure reachability check for the golden-path guarantee: can a blob launch from pad A and
 * reach pad B? Mechanic pads use their surface/route normal at `speed`; flat pads use the
 * actual slingshot launch curve because charging a flat-pad launch also adds lateral speed.
 * Ballistic model under gravity g (>0 magnitude): from A's top, the launch reaches at least
 * B's height with enough lateral travel to land within B's footprint.
 *
 * Conservative: treats the blob as a point. The shipped golden path ignores air-steer so the
 * dev harness can draw the exact parabola it proves; air-steer remains extra player agency.
 */

/** Surface normal of a pad: its `cant` tilted, else straight up. Mirrors cantNormal but
 *  kept local + dependency-free so this stays a pure world-gen helper. */
type SourceMode = GoldenPathProof["sourceMode"];
const MOVING_ROUTE_LATERAL = 0.22;
const WOBBLER_ROUTE_LATERAL = 0.24;

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
    const lateral = Math.min(
      MOVING_ROUTE_LATERAL,
      (trampCfg.movingAmplitude * trampCfg.movingSpeed) / 12,
    );
    return [lateral * mx, Math.sqrt(Math.max(0.01, 1 - lateral * lateral)), lateral * mz];
  }

  if (mode === "wobbler") {
    const [wx, wz] = unitToward(pad, target);
    const lateral = Math.min(WOBBLER_ROUTE_LATERAL, Math.sin(trampCfg.wobblerMaxTiltRad));
    return [lateral * wx, Math.sqrt(Math.max(0.01, 1 - lateral * lateral)), lateral * wz];
  }

  const [cx, cz] = unit2(pad.cant ?? unitToward(pad, target));
  const m = Math.hypot(cx, cz) || 1;
  const tilt = pad.cantAngleRad ?? tiltRad;
  const s = Math.sin(tilt);
  return [(s * cx) / m, Math.cos(tilt), (s * cz) / m];
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

const MIN_CERTIFIED_SPEED = launchCfg.basePower;
const MAX_CERTIFIED_SPEED =
  (launchCfg.basePower + launchCfg.powerPerCharge) * launchCfg.perfectRelease.bonus;
const APEX_MARGIN = 1.4;
const SLINGSHOT_Z_SCALE = 1.25;
const MANUAL_CHARGE_STEP = 0.005;

function heightClearanceSpeed(dy: number, normalY: number, g: number): number {
  const minVertical = Math.sqrt(Math.max(0, 2 * g * Math.max(0, dy + APEX_MARGIN)));
  return clamp(minVertical / Math.max(0.05, normalY), MIN_CERTIFIED_SPEED, MAX_CERTIFIED_SPEED);
}

function centeredImpactSpeed(
  a: TrampolineSpec,
  b: TrampolineSpec,
  normal: Vec3,
  dy: number,
  g: number,
): number | null {
  const lateral = Math.hypot(normal[0], normal[2]);
  if (lateral < 1e-5) return null;

  const ux = normal[0] / lateral;
  const uz = normal[2] / lateral;
  const gapX = b.position[0] - a.position[0];
  const gapZ = b.position[2] - a.position[2];
  const along = gapX * ux + gapZ * uz;
  if (along <= 0) return null;

  const cross = Math.hypot(gapX - ux * along, gapZ - uz * along);
  const halfFoot = Math.max(b.width, b.depth) * 0.5;
  if (cross > halfFoot) return null;

  const minSpeed = clamp(
    Math.sqrt(Math.max(0, 2 * g * Math.max(0, dy))) / Math.max(0.05, normal[1]) + 0.01,
    MIN_CERTIFIED_SPEED,
    MAX_CERTIFIED_SPEED,
  );
  const landingAlong = (launchSpeed: number) => {
    const vy = normal[1] * launchSpeed;
    const disc = vy * vy - 2 * g * dy;
    if (disc < 0) return Number.POSITIVE_INFINITY;
    const flightTime = Math.max(0, (vy + Math.sqrt(disc)) / g);
    return lateral * launchSpeed * flightTime;
  };

  if (landingAlong(minSpeed) > along || landingAlong(MAX_CERTIFIED_SPEED) < along) return null;

  let lo = minSpeed;
  let hi = MAX_CERTIFIED_SPEED;
  for (let i = 0; i < 32; i++) {
    const mid = (lo + hi) * 0.5;
    if (landingAlong(mid) > along) hi = mid;
    else lo = mid;
  }
  const speed = (lo + hi) * 0.5;
  if (speed < MIN_CERTIFIED_SPEED || speed > MAX_CERTIFIED_SPEED) return null;
  return speed;
}

function uniqueSpeeds(speeds: readonly (number | null | undefined)[]): number[] {
  const result: number[] = [];
  for (const speed of speeds) {
    if (speed === null || speed === undefined || !Number.isFinite(speed)) continue;
    const clamped = clamp(speed, MIN_CERTIFIED_SPEED, MAX_CERTIFIED_SPEED);
    if (result.every((s) => Math.abs(s - clamped) > 0.01)) result.push(clamped);
  }
  return result;
}

function launchSpeedForCharge(charge: number): number {
  const perfect =
    charge >= launchCfg.perfectRelease.min && charge <= launchCfg.perfectRelease.max
      ? launchCfg.perfectRelease.bonus
      : 1;
  return (
    (launchCfg.basePower + charge * launchCfg.powerPerCharge) *
    trampCfg.reboundMultiplier.standard *
    perfect
  );
}

function slingshotDirectionToward(a: TrampolineSpec, b: TrampolineSpec, charge: number): Vec3 {
  const [ux, uz] = unitToward(a, b);
  const angle = Math.atan2(SLINGSHOT_Z_SCALE * ux, uz);
  const x = Math.sin(angle) * charge;
  const z = Math.cos(angle) * charge * SLINGSHOT_Z_SCALE;
  const y = 0.35 + charge * 1.62;
  const len = Math.hypot(x, y, z) || 1;
  return [x / len, y / len, z / len];
}

/**
 * Can a launch off `a` reach `b`? `speed` is the rebound launch speed, `g` gravity magnitude,
 * `tiltRad` the canted tilt, `airSteerAccel` the lateral acceleration the player can apply
 * mid-air. This remains available for balance experiments, but the shipped golden path uses
 * solveGoldenPath() instead so the dev harness can prove the certified route as a true
 * parabola.
 *
 * Returns true if the ballistic arc clears B's height AND, by the time it descends back to
 * that height, the launch's lateral reach PLUS the air-steer budget covers the lateral gap to B
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
  // Time to IMPACT B's height: the larger root of dy = vy·t − ½g·t². The smaller root is the
  // rising pass through the target height; using it "proves" routes that never actually land.
  const disc = vy * vy - 2 * g * dy;
  const t = Math.max(0, (vy + Math.sqrt(Math.max(0, disc))) / g);
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
export const PAD_SURFACE_Y = 0.72;

function proofFromVelocity(
  a: TrampolineSpec,
  b: TrampolineSpec,
  launchNormal: Vec3,
  launchSpeed: number,
  g: number,
  requiredCant: boolean,
  sourceMode: SourceMode,
  includeSamples = true,
): GoldenPathProof | null {
  const origin: Vec3 = [a.position[0], a.position[1] + PAD_SURFACE_Y, a.position[2]];
  const targetY = b.position[1] + PAD_SURFACE_Y;
  const dy = targetY - origin[1];
  const velocity: Vec3 = [
    launchNormal[0] * launchSpeed,
    launchNormal[1] * launchSpeed,
    launchNormal[2] * launchSpeed,
  ];

  if (velocity[1] * velocity[1] < 2 * g * dy) return null;
  const disc = velocity[1] * velocity[1] - 2 * g * dy;
  const flightTime = Math.max(0, (velocity[1] + Math.sqrt(Math.max(0, disc))) / g);
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
  const launchAngleRad = Math.acos(Math.min(1, Math.max(-1, launchNormal[1])));
  const samples: Vec3[] = includeSamples
    ? Array.from({ length: SAMPLE_COUNT + 1 }, (_, i) => {
        const t = flightTime * (i / SAMPLE_COUNT);
        return trajectoryPoint(origin, velocity, g, t);
      })
    : [];
  return {
    toPadId: b.id,
    launchNormal,
    launchSpeed,
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

export function solveFlatLaunchProofs(
  a: TrampolineSpec,
  b: TrampolineSpec,
  g = G,
  includeSamples = true,
): GoldenPathProof[] {
  const proofs: GoldenPathProof[] = [];
  for (let charge = MANUAL_CHARGE_STEP; charge <= 1 + 1e-9; charge += MANUAL_CHARGE_STEP) {
    const launchNormal = slingshotDirectionToward(a, b, charge);
    const launchSpeed = launchSpeedForCharge(charge);
    const proof = proofFromVelocity(
      a,
      b,
      launchNormal,
      launchSpeed,
      g,
      false,
      "flat",
      includeSamples,
    );
    if (proof) proofs.push(proof);
  }
  return proofs;
}

/**
 * Construct the actual passive golden-path parabola from `a` to `b`, or null if the launch
 * does not descend into B's footprint. Unlike canReach(..., airSteer), this is a visible,
 * screenshotable route: the generated samples are the route the dev harness draws in red.
 */
export function solveGoldenPath(
  a: TrampolineSpec,
  b: TrampolineSpec,
  speed?: number,
  g = G,
  tiltRad = TILT,
  requiredCant = a.type === "canted",
  sourceMode = inferredMode(a),
): GoldenPathProof | null {
  if (sourceMode === "flat") {
    if (a.type !== "standard") return null;
    const proofs = solveFlatLaunchProofs(a, b, g);
    if (speed !== undefined) {
      return proofs.find((proof) => Math.abs(proof.launchSpeed - speed) < 0.001) ?? null;
    }
    return (
      proofs
        .sort((x, y) => y.landingPrecision - x.landingPrecision || x.launchSpeed - y.launchSpeed)
        .at(0) ?? null
    );
  }

  const n = sourceNormal(a, b, tiltRad, sourceMode);
  const targetY = b.position[1] + PAD_SURFACE_Y;
  const dy = targetY - (a.position[1] + PAD_SURFACE_Y);
  const candidates =
    speed === undefined
      ? uniqueSpeeds([
          centeredImpactSpeed(a, b, n, dy, g),
          heightClearanceSpeed(dy, n[1], g),
          CLIMB_SPEED,
        ])
      : [speed];
  for (const launchSpeed of candidates) {
    const proof = proofFromVelocity(a, b, n, launchSpeed, g, requiredCant, sourceMode);
    if (proof) return proof;
  }
  return null;
}

/**
 * Climb-tuning constants — the single source of truth the world generator and the climb proof
 * (reachable.test.ts) both use, so the placement rule and the playability check can never
 * drift apart. A proof may solve a lower per-pair launch speed to land on the descending side
 * of the parabola; CLIMB_SPEED is retained as the upper tuning reference/fallback candidate.
 */
export const CLIMB_SPEED = 30;
const G = Math.abs(GRAVITY[1]);
const TILT = trampCfg.cantedTiltRad;

/**
 * Golden-path predicate: can the blob get from pad `a` to pad `b` under the shipped launch
 * speed, gravity, and canted tilt as a passive parabola? The generator attaches that full
 * proof to every source pad for seed verification and dev proof rendering.
 */
export function reaches(a: TrampolineSpec, b: TrampolineSpec): boolean {
  return solveGoldenPath(a, b) !== null;
}
