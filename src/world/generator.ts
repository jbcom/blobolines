import { trampoline as trampCfg } from "@/config";
import type { Rng } from "@/core/math";
import type {
  CrystalSpec,
  GoldenPathProof,
  PowerUpType,
  TrampolineSpec,
  TrampType,
  Vec3,
  WorldDifficulty,
} from "@/core/types";
import { GRAVITY } from "@/sim/physics";
import { pickCrystalTier } from "./crystalTier";
import {
  type RouteDifficultyProfile,
  routeCantAngle,
  routePadType,
  routeProfile,
} from "./difficulty";
import { CLIMB_SPEED, solveGoldenPath } from "./reachable";

export interface PowerUpSpec {
  position: Vec3;
  type: PowerUpType;
}

/**
 * Procedural vertical world generator (pure, seeded). Produces an endless upward spiral
 * of trampolines — the tower the player climbs. Deterministic given an Rng, so a seed
 * replays the same course. Generation is incremental: call generateUpTo to extend the
 * tower as the blob climbs.
 */

export interface GeneratedChunk {
  trampolines: TrampolineSpec[];
  crystals: CrystalSpec[];
  powerups: PowerUpSpec[];
  /** Highest Y generated so far (feed back as `fromY` next call). */
  highestY: number;
  /** Last pad placed — feed back as `prevPad` next call so the golden-path cant can reach
   *  ACROSS chunk boundaries (otherwise the first pad of each chunk could be unreachable). */
  lastPad: TrampolineSpec | null;
}

/** Hard cap for a certified canted route: the tilt lowers the vertical launch component, so
 *  step heights must stay below that canted apex with margin. Difficulty comes from lateral
 *  shape and pad type, not from impossible vertical jumps. */
const MAX_GOLDEN_STEP_Y = 15.4;
/** Consecutive pads must never collapse into an overhead column. This is the minimum
 *  horizontal read between the source and successor for the certified main path. */
const MIN_SUCCESSOR_LATERAL = 3.45;
const MAX_SUCCESSOR_LATERAL = 10.8;
/** Opening-guide band: the first few pads must read as a visible staircase from the starter,
 *  not as a near-overhead column that only works in the reachability proof. */
const STARTER_GUIDE_Y = 36;
const STARTER_MAX_STEP_Y = 9.25;
const STARTER_MIN_LATERAL = 3.6;
const STARTER_MAX_LATERAL = 4.8;
const STARTER_MIN_FOOTPRINT = 8.4;
const FALLBACK_FOOTPRINT = 7.2;
const G = Math.abs(GRAVITY[1]);

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function starterGuidePosition(prev: TrampolineSpec, target: Vec3, fallbackAngle: number): Vec3 {
  if (prev.position[1] >= STARTER_GUIDE_Y) return target;

  const [px, , pz] = prev.position;
  const dx = target[0] - px;
  const dz = target[2] - pz;
  const gap = Math.hypot(dx, dz);
  const dirX = gap > 0.001 ? dx / gap : Math.cos(fallbackAngle);
  const dirZ = gap > 0.001 ? dz / gap : Math.sin(fallbackAngle);
  const guidedGap = clamp(gap, STARTER_MIN_LATERAL, STARTER_MAX_LATERAL);
  return [px + dirX * guidedGap, target[1], pz + dirZ * guidedGap];
}

function separatedSuccessorPosition(
  prev: TrampolineSpec,
  target: Vec3,
  fallbackAngle: number,
): Vec3 {
  const [px, , pz] = prev.position;
  const dx = target[0] - px;
  const dz = target[2] - pz;
  const gap = Math.hypot(dx, dz);
  const dirX = gap > 0.001 ? dx / gap : Math.cos(fallbackAngle);
  const dirZ = gap > 0.001 ? dz / gap : Math.sin(fallbackAngle);
  const maxGap =
    prev.position[1] < STARTER_GUIDE_Y
      ? STARTER_MAX_LATERAL
      : Math.min(MAX_SUCCESSOR_LATERAL, 7 + prev.position[1] / 120);
  const guidedGap = clamp(gap, MIN_SUCCESSOR_LATERAL, maxGap);
  return [px + dirX * guidedGap, target[1], pz + dirZ * guidedGap];
}

function withPosition(pad: TrampolineSpec, position: Vec3): TrampolineSpec {
  return { ...pad, id: position[1], position };
}

function aim2(from: TrampolineSpec, to: TrampolineSpec): readonly [number, number] {
  const dx = to.position[0] - from.position[0];
  const dz = to.position[2] - from.position[2];
  const m = Math.hypot(dx, dz);
  return m < 1e-6 ? [1, 0] : [dx / m, dz / m];
}

function aimSourceMechanic(
  prev: TrampolineSpec,
  target: TrampolineSpec,
  profile: RouteDifficultyProfile,
) {
  if (prev.type === "canted") {
    const direction = aim2(prev, target);
    (prev as { cant?: readonly [number, number] }).cant = direction;
    prev.cantAngleRad = routeCantAngle(profile, prev.routeIndex ?? 0);
    prev.moveAxis = undefined;
    return;
  }
  if (prev.type === "moving") {
    prev.moveAxis = aim2(prev, target);
    prev.cant = undefined;
    prev.cantAngleRad = undefined;
    return;
  }
  prev.moveAxis = undefined;
  if (prev.type !== "canted") {
    prev.cant = undefined;
    prev.cantAngleRad = undefined;
  }
}

function sourceLateralForProof(
  prev: TrampolineSpec,
  profile: RouteDifficultyProfile,
): {
  lateral: number;
  up: number;
} {
  if (prev.type === "canted") {
    const angle = prev.cantAngleRad ?? routeCantAngle(profile, prev.routeIndex ?? 0);
    return { lateral: Math.sin(angle), up: Math.cos(angle) };
  }
  if (prev.type === "moving") {
    const lateral = Math.min(0.5, (trampCfg.movingAmplitude * trampCfg.movingSpeed) / 12);
    return { lateral, up: Math.sqrt(Math.max(0.01, 1 - lateral * lateral)) };
  }
  if (prev.type === "wobbler") {
    const lateral = Math.sin(trampCfg.wobblerMaxTiltRad);
    return { lateral, up: Math.sqrt(Math.max(0.01, 1 - lateral * lateral)) };
  }
  return { lateral: 0, up: 1 };
}

function predictedLandingGap(
  prev: TrampolineSpec,
  target: TrampolineSpec,
  profile: RouteDifficultyProfile,
): number {
  const { lateral, up } = sourceLateralForProof(prev, profile);
  if (lateral <= 0) return 0;
  const vy = up * CLIMB_SPEED;
  const dy = target.position[1] - prev.position[1];
  if (vy * vy < 2 * G * dy) return 0;
  const t = Math.max(0, (vy - Math.sqrt(Math.max(0, vy * vy - 2 * G * dy))) / G);
  return lateral * CLIMB_SPEED * t;
}

function proofAccepted(
  prev: TrampolineSpec,
  target: TrampolineSpec,
  proof: GoldenPathProof | null,
  profile: RouteDifficultyProfile,
): proof is GoldenPathProof {
  if (!proof) return false;
  const flatToFlat = prev.type === "standard" && target.type === "standard";
  if (flatToFlat && !profile.allowFlatToFlat) return false;
  const minLip = flatToFlat ? profile.flatToFlatMinLipClearance : profile.minLipClearance;
  const minPrecision = flatToFlat
    ? profile.flatToFlatMinLandingPrecision
    : profile.minLandingPrecision;
  return (
    proof.lipClearance >= minLip &&
    proof.lipClearanceRatio >= profile.minLipClearanceRatio &&
    proof.landingPrecision >= minPrecision
  );
}

function minPrecisionForPair(
  prev: TrampolineSpec,
  target: TrampolineSpec,
  profile: RouteDifficultyProfile,
): number {
  return prev.type === "standard" && target.type === "standard"
    ? profile.flatToFlatMinLandingPrecision
    : profile.minLandingPrecision;
}

function minLipForPair(
  prev: TrampolineSpec,
  target: TrampolineSpec,
  profile: RouteDifficultyProfile,
): number {
  return prev.type === "standard" && target.type === "standard"
    ? profile.flatToFlatMinLipClearance
    : profile.minLipClearance;
}

function widenForHumanMargin(
  prev: TrampolineSpec,
  target: TrampolineSpec,
  profile: RouteDifficultyProfile,
): TrampolineSpec {
  const lateral = Math.hypot(
    target.position[0] - prev.position[0],
    target.position[2] - prev.position[2],
  );
  const predicted = predictedLandingGap(prev, target, profile);
  const estimatedMiss = prev.type === "standard" ? lateral : Math.abs(predicted - lateral);
  const lip = minLipForPair(prev, target, profile);
  const precision = Math.max(
    profile.minLipClearanceRatio,
    minPrecisionForPair(prev, target, profile),
  );
  const safety = 1.08;
  const halfForLip = (estimatedMiss + lip) * safety;
  const halfForPercent = (estimatedMiss / Math.max(0.05, 1 - precision)) * safety;
  const footprint = Math.max(FALLBACK_FOOTPRINT, halfForLip * 2, halfForPercent * 2);
  return {
    ...target,
    width: Math.max(target.width, footprint),
    depth: Math.max(target.depth, footprint),
  };
}

/**
 * Make `pad` reachable from `prev`, mutating `prev` (cant) and/or returning an adjusted pad,
 * then attaching a `goldenPath` proof to `prev`. The proof is a passive, visible parabola
 * sampled in world space; no hidden air-steer budget is required for the certified route.
 */
function ensureReachable(
  prev: TrampolineSpec,
  pad: TrampolineSpec,
  profile: RouteDifficultyProfile,
): TrampolineSpec {
  const [px, , pz] = prev.position;
  const attachProof = (proof: GoldenPathProof) => {
    prev.goldenPath = proof;
  };
  /** Make prev reach `p` using its planned source mechanic. The proof must satisfy the
   *  selected difficulty's human margin rules, not just the binary parabola predicate. */
  const proveAt = (p: TrampolineSpec): GoldenPathProof | null => {
    aimSourceMechanic(prev, p, profile);
    const proof = solveGoldenPath(prev, p, undefined, undefined, undefined, prev.type === "canted");
    return proofAccepted(prev, p, proof, profile) ? proof : null;
  };

  const initial = proveAt(pad);
  if (initial) {
    attachProof(initial);
    return pad;
  }

  // Still short: pull the pad toward prev until the visible parabola is certified, but NEVER
  // below MIN_SUCCESSOR_LATERAL. A directly-overhead successor is readable only to the math, not
  // to the player, so it is not a legal termination case.
  const dx = pad.position[0] - px;
  const dz = pad.position[2] - pz;
  const gap = Math.hypot(dx, dz);
  const dirX = gap > 0.001 ? dx / gap : 1;
  const dirZ = gap > 0.001 ? dz / gap : 0;
  const minK = gap > MIN_SUCCESSOR_LATERAL ? MIN_SUCCESSOR_LATERAL / gap : 1;
  let result = pad;
  if (prev.type !== "standard") {
    const maxGap =
      prev.position[1] < STARTER_GUIDE_Y
        ? STARTER_MAX_LATERAL
        : Math.min(MAX_SUCCESSOR_LATERAL, 7 + prev.position[1] / 120);
    const projectedGap = clamp(
      predictedLandingGap(prev, pad, profile),
      MIN_SUCCESSOR_LATERAL,
      maxGap,
    );
    result = widenForHumanMargin(
      prev,
      withPosition(pad, [px + dirX * projectedGap, pad.position[1], pz + dirZ * projectedGap]),
      profile,
    );
    const proof = proveAt(result);
    if (proof) {
      attachProof(proof);
      return result;
    }
  }
  const fractions = [1, 0.85, 0.7, 0.55, 0.4, 0.25, 0.1, minK]
    .map((k) => Math.max(minK, k))
    .filter((k, i, xs) => i === 0 || Math.abs(k - xs[i - 1]) > 0.001);
  for (const k of fractions) {
    result = widenForHumanMargin(
      prev,
      withPosition(pad, [px + dx * k, pad.position[1], pz + dz * k]),
      profile,
    );
    const proof = proveAt(result);
    if (proof) {
      attachProof(proof);
      return result;
    }
  }

  // Last constructive fallback: keep the legal lateral separation, lower the vertical step to
  // the canted-proof ceiling, and widen the target only enough to preserve a playable landing
  // footprint. If this ever fails, the tuning constants are internally contradictory.
  const fallbackY = Math.min(pad.position[1], prev.position[1] + MAX_GOLDEN_STEP_Y);
  result = withPosition(
    {
      ...pad,
      width: Math.max(pad.width, FALLBACK_FOOTPRINT),
      depth: Math.max(pad.depth, FALLBACK_FOOTPRINT),
    },
    [px + dx * minK, fallbackY, pz + dz * minK],
  );
  result = widenForHumanMargin(prev, result, profile);
  const proof = proveAt(result);
  if (!proof) {
    throw new Error(
      `Unable to certify golden path ${prev.type}->${result.type} from y=${prev.position[1].toFixed(2)} to y=${result.position[1].toFixed(2)}`,
    );
  }
  attachProof(proof);
  return result;
}

/**
 * Generate trampolines (and crystals) from `fromY` up to at least `targetY`.
 * The first pads (low) are always `standard` so the start is forgiving.
 */

export function generateUpTo(
  rng: Rng,
  fromY: number,
  targetY: number,
  prevPad: TrampolineSpec | null = null,
  difficulty: WorldDifficulty = "ready",
): GeneratedChunk {
  const trampolines: TrampolineSpec[] = [];
  const crystals: CrystalSpec[] = [];
  const powerups: PowerUpSpec[] = [];
  let y = fromY;
  const profile = routeProfile(difficulty);
  /** Previous pad, so we can cant it toward this one (golden-path reachability). Threaded in
   *  from the prior chunk's lastPad so canting reaches across the chunk boundary. */
  let prev: TrampolineSpec | null = prevPad;

  while (y < targetY) {
    const routeIndex = (prev?.routeIndex ?? 0) + 1;
    // Vertical spacing GROWS with altitude (difficulty curve): gaps widen from ~7.5m low to
    // ~15m higher, so the climb demands more launch commitment as it goes. Capped under the
    // canted-launch apex so a tilted certified parabola can still clear the next pad.
    const spacingBoost = Math.min(1, y / 600) * 3;
    const rawStepY = 7.5 + spacingBoost + rng.next() * 6.8;
    const sourceMaxStepY = prev
      ? Math.max(5.8, (sourceLateralForProof(prev, profile).up * CLIMB_SPEED) ** 2 / (2 * G) - 1.6)
      : MAX_GOLDEN_STEP_Y;
    const routeMaxStepY = Math.min(
      profile.compressedEvery > 0 && routeIndex % profile.compressedEvery === 0
        ? profile.compressedMaxStepY
        : MAX_GOLDEN_STEP_Y,
      sourceMaxStepY,
    );
    const stepY =
      prev && prev.position[1] < STARTER_GUIDE_Y
        ? Math.min(rawStepY, STARTER_MAX_STEP_Y)
        : Math.min(rawStepY, routeMaxStepY);
    y += stepY;

    // Spiral placement: angle advances with height, radius gently oscillates.
    const angle = y * 0.08 + rng.next() * 0.65;
    const radius = 2 + Math.sin(y * 0.04) * 6;
    let x = Math.cos(angle) * radius;
    let z = Math.sin(angle) * radius;

    // Difficulty: pads shrink with altitude.
    const diff = Math.max(0.4, 1 - y / 650);
    let width = (5.8 + rng.next() * 2.8) * diff;
    let depth = (5.8 + rng.next() * 2.8) * diff;
    // Shape variety: ~1 in 4 pads gets a distinct silhouette — a long plank (wide+thin) or a
    // beam (deep+narrow) — so the tower isn't a stack of identical squares (and the footprint
    // affects how you must land). The other axis shrinks to keep the area sane.
    const shapeRoll = rng.next();
    if (shapeRoll > 0.85) {
      width *= 1.55;
      depth *= 0.6;
    } else if (shapeRoll > 0.7) {
      depth *= 1.55;
      width *= 0.6;
    }

    // The route profile owns the source/target rhythm. That is deliberate: a flat-to-flat
    // sequence can be mathematically reachable but hard to READ in 3D, so approachable modes
    // teach with moving/canted/wobbler mechanics and reserve precision flat arcs for harder
    // modes.
    let type: TrampType = routePadType(profile, routeIndex);

    if (prev) {
      [x, y, z] = separatedSuccessorPosition(prev, [x, y, z], angle);
    }

    if (prev && prev.position[1] < STARTER_GUIDE_Y) {
      [x, y, z] = starterGuidePosition(prev, [x, y, z], angle);
      width = Math.max(width, STARTER_MIN_FOOTPRINT);
      depth = Math.max(depth, STARTER_MIN_FOOTPRINT);
    }

    // GOLDEN-PATH REACHABILITY: GUARANTEE the previous pad has a stored, screenshotable
    // parabola to this one. The fixup is constructive (no silent fall-through):
    //   1. If a flat prev already has a passive visible parabola → leave it alone.
    //   2. Else, above the forgiving start, CANT prev toward this pad and prove that arc.
    //   3. If it still cannot be proven, pull/lower/widen within legal readability limits.
    //      The result must preserve lateral separation and attach `prev.goldenPath`.
    if (prev) {
      const fixed = ensureReachable(
        prev,
        { id: y, routeIndex, position: [x, y, z], width, depth, type },
        profile,
      );
      x = fixed.position[0];
      y = fixed.position[1];
      z = fixed.position[2];
      width = fixed.width;
      depth = fixed.depth;
      type = fixed.type;
    }

    // id = the pad's generation Y (strictly increasing across the whole tower → unique).
    const pad: TrampolineSpec = { id: y, routeIndex, position: [x, y, z], width, depth, type };
    trampolines.push(pad);
    prev = pad;

    // ~60% of pads float a crystal above them, each with an altitude-weighted rarity tier.
    if (rng.next() > 0.38) {
      crystals.push({
        position: [
          x + (rng.next() - 0.5) * 2.5,
          y + 3.2 + rng.next() * 2.8,
          z + (rng.next() - 0.5) * 2.5,
        ],
        tier: pickCrystalTier(rng, y),
      });
    }

    // ~12% of pads (above the forgiving start) float a power-up.
    if (y > 30 && rng.next() > 0.88) {
      // Spawn weighting: the four "strong" buffs (shield one-shot revive, slow-mo bullet-time,
      // score-doubler, multi-bounce charges) are each uncommon (~0.14), with the workhorse
      // magnet/thruster splitting the rest (~0.22 each).
      const roll = rng.next();
      const type: PowerUpType =
        roll < 0.14
          ? "shield"
          : roll < 0.28
            ? "slowmo"
            : roll < 0.42
              ? "doubler"
              : roll < 0.56
                ? "multibounce"
                : roll < 0.78
                  ? "magnet"
                  : "thruster";
      powerups.push({
        position: [
          x + (rng.next() - 0.5) * 1.5,
          y + 4.5 + rng.next() * 2,
          z + (rng.next() - 0.5) * 1.5,
        ],
        type,
      });
    }
  }

  return { trampolines, crystals, powerups, highestY: y, lastPad: prev };
}

/** The fixed starting pad (large, centered, standard) the blob begins on. */
export function starterPad(): TrampolineSpec {
  return { id: 0, routeIndex: 0, position: [0, 0, 0], width: 7.5, depth: 7.5, type: "standard" };
}
