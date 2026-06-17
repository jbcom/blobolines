import { launch as launchCfg, trampoline as trampCfg } from "@/config";
import type { Rng } from "@/core/math";
import type {
  CrystalSpec,
  GoldenPathProof,
  GoldenPathVariant,
  PowerUpType,
  TrampolineSpec,
  TrampType,
  Vec3,
  WorldDifficulty,
} from "@/core/types";
import { GRAVITY } from "@/sim/physics";
import { pickCrystalTier } from "./crystalTier";
import {
  effectiveRouteDifficulty,
  type RouteDifficultyProfile,
  routeCantAngle,
  routeProfile,
} from "./difficulty";
import { CLIMB_SPEED, solveFlatLaunchProofs, solveGoldenPath } from "./reachable";

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
const MAX_SUCCESSOR_LATERAL = 16;
/** Opening-guide band: the first few pads must read as a visible staircase from the starter,
 *  not as a near-overhead column that only works in the reachability proof. */
const STARTER_GUIDE_Y = 36;
const STARTER_MIN_STEP_Y = 5.4;
const STARTER_STEP_SPREAD = 1.7;
const STARTER_MAX_STEP_Y = 7.1;
const STARTER_MIN_LATERAL = 6.8;
const STARTER_MAX_LATERAL = 10.4;
const STARTER_MIN_FOOTPRINT = 8.8;
const G = Math.abs(GRAVITY[1]);
const MIN_CERTIFIED_SPEED = launchCfg.basePower;
const MAX_CERTIFIED_SPEED =
  (launchCfg.basePower + launchCfg.powerPerCharge) * launchCfg.perfectRelease.bonus;
const ROUTE_TYPES: readonly TrampType[] = [
  "standard",
  "moving",
  "canted",
  "wobbler",
  "booster",
  "ice",
  "super",
  "fragile",
];
const SOURCE_MECHANICS: readonly TrampType[] = ["standard", "moving", "canted", "wobbler"];
const STARTER_VISIBLE_MECHANICS: readonly TrampType[] = ["canted", "wobbler"];
const READY_OPENING_MAX_TURN_RAD = 0.72;
const READY_MAX_TURN_RAD = 1.05;
const MEDIUM_MAX_TURN_RAD = 1.25;
const HARD_MAX_TURN_RAD = 1.55;

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function weightedPadType(rng: Rng, profile: RouteDifficultyProfile): TrampType {
  const total = ROUTE_TYPES.reduce((sum, type) => sum + (profile.typeWeights[type] ?? 0), 0);
  let pick = rng.next() * total;
  for (const type of ROUTE_TYPES) {
    pick -= profile.typeWeights[type] ?? 0;
    if (pick <= 0) return type;
  }
  return "standard";
}

function starterVisiblePadType(
  rng: Rng,
  previousType: TrampType,
  rolledType: TrampType,
): TrampType {
  if (STARTER_VISIBLE_MECHANICS.includes(rolledType) && rolledType !== previousType) {
    return rolledType;
  }
  const options = STARTER_VISIBLE_MECHANICS.filter((type) => type !== previousType);
  return options[Math.floor(rng.next() * options.length)] ?? "canted";
}

function normalizeAngle(rad: number): number {
  let a = rad;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function routeTurnLimit(profile: RouteDifficultyProfile, opening: boolean): number {
  if (profile.difficulty === "ready")
    return opening ? READY_OPENING_MAX_TURN_RAD : READY_MAX_TURN_RAD;
  if (profile.difficulty === "medium") return MEDIUM_MAX_TURN_RAD;
  if (profile.difficulty === "hard") return HARD_MAX_TURN_RAD;
  return Math.PI;
}

function constrainRouteTurn(
  prev: TrampolineSpec,
  target: Vec3,
  lastDir: readonly [number, number] | null,
  profile: RouteDifficultyProfile,
  routeIndex: number,
  openingTurnSign: number,
): Vec3 {
  if (!lastDir) return target;
  const opening = prev.position[1] < STARTER_GUIDE_Y;
  const limit = routeTurnLimit(profile, opening);
  if (limit >= Math.PI) return target;

  const [px, , pz] = prev.position;
  const dx = target[0] - px;
  const dz = target[2] - pz;
  const gap = Math.hypot(dx, dz);
  if (gap < 0.001) return target;

  const baseAngle = Math.atan2(lastDir[1], lastDir[0]);
  const rawAngle = Math.atan2(dz, dx);
  const rawDelta = normalizeAngle(rawAngle - baseAngle);
  const lockedOpeningArc = profile.difficulty === "ready" && opening && routeIndex <= 5;
  const delta = lockedOpeningArc
    ? openingTurnSign * clamp(Math.abs(rawDelta), 0.16, limit)
    : clamp(rawDelta, -limit, limit);
  const angle = baseAngle + delta;
  return [px + Math.cos(angle) * gap, target[1], pz + Math.sin(angle) * gap];
}

function proofToVariant(proof: GoldenPathProof): GoldenPathVariant {
  return {
    launchSpeed: proof.launchSpeed,
    flightTime: proof.flightTime,
    apex: proof.apex,
    landing: proof.landing,
    clearance: proof.clearance,
    samples: proof.samples,
    landingPrecision: proof.landingPrecision,
    lipClearance: proof.lipClearance,
    lipClearanceRatio: proof.lipClearanceRatio,
    arcCompression: proof.arcCompression,
  };
}

function variantMultipliers(profile: RouteDifficultyProfile): number[] {
  if (profile.proofVariants <= 1) return [1];
  const spread = profile.proofVariantSpread;
  return [
    1,
    1 + spread,
    1 + spread * 2,
    1 - spread * 0.5,
    1 + spread * 3,
    1 - spread,
    1 + spread * 4,
  ];
}

function weightedSourceMechanics(
  rng: Rng,
  current: TrampType,
  profile: RouteDifficultyProfile,
): TrampType[] {
  const allowed =
    profile.difficulty === "ready"
      ? SOURCE_MECHANICS.filter((type) => type !== "moving")
      : [...SOURCE_MECHANICS];
  const remaining = [...allowed];
  const order: TrampType[] = [];
  while (remaining.length > 0) {
    const total = remaining.reduce((sum, type) => sum + (profile.typeWeights[type] ?? 0.1), 0);
    let pick = rng.next() * total;
    let pickedIndex = remaining.length - 1;
    for (let i = 0; i < remaining.length; i++) {
      pick -= profile.typeWeights[remaining[i]] ?? 0.1;
      if (pick <= 0) {
        pickedIndex = i;
        break;
      }
    }
    order.push(remaining.splice(pickedIndex, 1)[0] ?? "standard");
  }
  if (!allowed.includes(current)) {
    return ["standard", ...order.filter((type) => type !== "standard")];
  }
  return [current, ...order.filter((type) => type !== current)];
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
      : Math.min(MAX_SUCCESSOR_LATERAL, 9 + prev.position[1] / 100);
  const guidedGap = clamp(gap, MIN_SUCCESSOR_LATERAL, maxGap);
  return [px + dirX * guidedGap, target[1], pz + dirZ * guidedGap];
}

function legalMaxGap(prev: TrampolineSpec): number {
  return prev.position[1] < STARTER_GUIDE_Y
    ? STARTER_MAX_LATERAL
    : Math.min(MAX_SUCCESSOR_LATERAL, 9 + prev.position[1] / 100);
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

function aimToPosition(from: TrampolineSpec, to: Vec3): readonly [number, number] {
  const dx = to[0] - from.position[0];
  const dz = to[2] - from.position[2];
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

function applySourceMechanic(
  prev: TrampolineSpec,
  type: TrampType,
  target: TrampolineSpec,
  profile: RouteDifficultyProfile,
) {
  if (type !== "standard" || SOURCE_MECHANICS.includes(prev.type)) {
    prev.type = type;
  }
  aimSourceMechanic(prev, target, profile);
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
    const lateral = Math.min(0.22, (trampCfg.movingAmplitude * trampCfg.movingSpeed) / 12);
    return { lateral, up: Math.sqrt(Math.max(0.01, 1 - lateral * lateral)) };
  }
  if (prev.type === "wobbler") {
    const lateral = Math.min(0.24, Math.sin(trampCfg.wobblerMaxTiltRad));
    return { lateral, up: Math.sqrt(Math.max(0.01, 1 - lateral * lateral)) };
  }
  return { lateral: 0, up: 1 };
}

function predictedLandingGap(
  prev: TrampolineSpec,
  target: TrampolineSpec,
  profile: RouteDifficultyProfile,
): number {
  const proof = solveGoldenPath(
    prev,
    target,
    undefined,
    undefined,
    undefined,
    prev.type === "canted",
  );
  if (proof) {
    return Math.hypot(proof.landing[0] - prev.position[0], proof.landing[2] - prev.position[2]);
  }

  const { lateral, up } = sourceLateralForProof(prev, profile);
  if (lateral <= 0) return 0;
  const dy = target.position[1] - prev.position[1];
  const minDescendingGap = (2 * Math.max(0, dy) * lateral) / Math.max(0.05, up) + 0.25;
  const speed = Math.min(
    CLIMB_SPEED,
    Math.sqrt(Math.max(0, 2 * G * Math.max(0, dy + 1.4))) / Math.max(0.05, up),
  );
  const vy = up * speed;
  if (vy * vy < 2 * G * dy) return 0;
  const t = Math.max(0, (vy + Math.sqrt(Math.max(0, vy * vy - 2 * G * dy))) / G);
  return Math.max(minDescendingGap, lateral * speed * t);
}

function proofAccepted(
  proof: GoldenPathProof | null,
  profile: RouteDifficultyProfile,
): proof is GoldenPathProof {
  if (!proof) return false;
  return (
    proof.apex[1] > proof.landing[1] + 0.2 &&
    proof.lipClearance >= profile.minLipClearance &&
    proof.lipClearanceRatio >= profile.minLipClearanceRatio &&
    proof.landingPrecision >= profile.minLandingPrecision
  );
}

function selectVariantProofs(
  proofs: readonly GoldenPathProof[],
  count: number,
): GoldenPathProof[] | null {
  if (proofs.length < count) return null;
  const byPrecision = [...proofs].sort(
    (a, b) => b.landingPrecision - a.landingPrecision || a.launchSpeed - b.launchSpeed,
  );
  const primary = byPrecision[0];
  if (!primary) return null;
  if (count <= 1) return [primary];

  const sorted = [...proofs].sort((a, b) => a.launchSpeed - b.launchSpeed);
  const anchors = [0, Math.floor((sorted.length - 1) * 0.5), sorted.length - 1];
  const picked: GoldenPathProof[] = [primary];
  const tryPick = (candidate: GoldenPathProof | undefined) => {
    if (!candidate || picked.length >= count) return;
    if (picked.some((p) => Math.abs(p.launchSpeed - candidate.launchSpeed) < 0.35)) return;
    picked.push(candidate);
  };

  for (const anchor of anchors) tryPick(sorted[anchor]);
  for (const proof of byPrecision) tryPick(proof);
  return picked.length >= count ? picked.slice(0, count) : null;
}

function proofWithVariants(
  prev: TrampolineSpec,
  target: TrampolineSpec,
  profile: RouteDifficultyProfile,
): GoldenPathProof | null {
  if (prev.type !== "canted" && prev.type !== "moving" && prev.type !== "wobbler") {
    const accepted = solveFlatLaunchProofs(prev, target).filter((proof) =>
      proofAccepted(proof, profile),
    );
    const selected = selectVariantProofs(accepted, profile.proofVariants);
    if (!selected) return null;
    const [primary, ...variants] = selected;
    return { ...primary, variants: [primary, ...variants].map(proofToVariant) };
  }

  const primary = solveGoldenPath(
    prev,
    target,
    undefined,
    undefined,
    undefined,
    prev.type === "canted",
  );
  if (!proofAccepted(primary, profile)) return null;
  const variants = [proofToVariant(primary)];
  for (const multiplier of variantMultipliers(profile).slice(1)) {
    if (variants.length >= profile.proofVariants) break;
    const launchSpeed = primary.launchSpeed * multiplier;
    if (launchSpeed < MIN_CERTIFIED_SPEED || launchSpeed > MAX_CERTIFIED_SPEED) continue;
    const variant = solveGoldenPath(
      prev,
      target,
      launchSpeed,
      undefined,
      undefined,
      prev.type === "canted",
    );
    if (!proofAccepted(variant, profile)) continue;
    variants.push(proofToVariant(variant));
  }
  return variants.length >= profile.proofVariants ? { ...primary, variants } : null;
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
  const estimatedMiss = Math.abs(predicted - lateral);
  const variantMargin =
    Math.max(0, profile.proofVariants - 1) *
    profile.proofVariantSpread *
    Math.max(1, predicted, lateral);
  const missBudget = estimatedMiss + variantMargin;
  const lip = profile.minLipClearance;
  const precision = Math.max(profile.minLipClearanceRatio, profile.minLandingPrecision);
  const safety = 1.08;
  const halfForLip = (missBudget + lip) * safety;
  const halfForPercent = (missBudget / Math.max(0.05, 1 - precision)) * safety;
  const footprint = Math.max(profile.minFootprint, halfForLip * 2, halfForPercent * 2);
  return {
    ...target,
    width: Math.max(target.width, footprint),
    depth: Math.max(target.depth, footprint),
  };
}

/**
 * Make `pad` reachable from `prev`, mutating `prev` (cant) and/or returning an adjusted pad,
 * then attaching a `goldenPath` proof to `prev`. The proof is a passive parabola
 * sampled in world space for diagnostics/dev evidence; no hidden air-steer budget is required
 * for the certified route.
 */
function ensureReachable(
  prev: TrampolineSpec,
  pad: TrampolineSpec,
  profile: RouteDifficultyProfile,
  rng: Rng,
): TrampolineSpec {
  const [px, , pz] = prev.position;
  const attachProof = (proof: GoldenPathProof) => {
    prev.goldenPath = proof;
  };
  const sourceCandidates =
    (prev.routeIndex ?? -1) === 0
      ? (["standard"] as const)
      : weightedSourceMechanics(rng, prev.type, profile);

  /** Make prev reach `p` using whichever source mechanic can prove the selected difficulty's
   *  variant count and impact-zone margins. */
  const proveAt = (p: TrampolineSpec): GoldenPathProof | null => {
    const accepted: { sourceType: TrampType; proof: GoldenPathProof; weight: number }[] = [];
    for (const sourceType of sourceCandidates) {
      const trial = { ...prev };
      applySourceMechanic(trial, sourceType, p, profile);
      const proof = proofWithVariants(trial, p, profile);
      if (!proof) continue;
      let weight = profile.typeWeights[sourceType] ?? 1;
      if (sourceType === prev.type) weight *= 1.25;
      // Easy should expose the player to several readable mechanics early; moving pads often
      // prove wide-margin arcs, so slightly downweight them in the visible opening when other
      // proof-valid mechanics exist.
      if (
        profile.difficulty === "ready" &&
        (prev.routeIndex ?? 0) < 12 &&
        sourceType === "moving"
      ) {
        weight *= 0.55;
      }
      accepted.push({ sourceType, proof, weight });
    }
    if (accepted.length === 0) return null;
    const totalWeight = accepted.reduce((sum, candidate) => sum + Math.max(0, candidate.weight), 0);
    let chosen = accepted[0];
    if (totalWeight > 0) {
      let pick = rng.next() * totalWeight;
      for (const candidate of accepted) {
        pick -= Math.max(0, candidate.weight);
        if (pick <= 0) {
          chosen = candidate;
          break;
        }
      }
    }
    applySourceMechanic(prev, chosen.sourceType, p, profile);
    return chosen.proof;
  };

  const initial = proveAt(pad);
  if (initial) {
    attachProof(initial);
    return pad;
  }

  // Still short: pull the pad toward prev until the dev-proof parabola is certified, but NEVER
  // below MIN_SUCCESSOR_LATERAL. A directly-overhead successor is readable only to the math, not
  // to the player, so it is not a legal termination case.
  const dx = pad.position[0] - px;
  const dz = pad.position[2] - pz;
  const gap = Math.hypot(dx, dz);
  const dirX = gap > 0.001 ? dx / gap : 1;
  const dirZ = gap > 0.001 ? dz / gap : 0;
  const minLegalLateral =
    prev.position[1] < STARTER_GUIDE_Y ? STARTER_MIN_LATERAL : MIN_SUCCESSOR_LATERAL;
  const minK = gap > minLegalLateral ? minLegalLateral / gap : 1;
  let result = pad;
  if (sourceCandidates.some((type) => type !== "standard")) {
    const maxGap = legalMaxGap(prev);
    const projectedGap = clamp(predictedLandingGap(prev, pad, profile), minLegalLateral, maxGap);
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

  const maxLegalGap = legalMaxGap(prev);
  const gapCandidates: number[] = [];
  const addGap = (candidate: number) => {
    const bounded = clamp(candidate, minLegalLateral, maxLegalGap);
    if (gapCandidates.every((g) => Math.abs(g - bounded) > 0.05)) gapCandidates.push(bounded);
  };
  addGap(gap);
  addGap(predictedLandingGap(prev, pad, profile));
  for (let i = 0; i <= 12; i++) {
    addGap(minLegalLateral + (maxLegalGap - minLegalLateral) * (i / 12));
  }
  gapCandidates.sort((a, b) => Math.abs(a - gap) - Math.abs(b - gap));
  for (const candidateGap of gapCandidates) {
    result = widenForHumanMargin(
      prev,
      withPosition(pad, [px + dirX * candidateGap, pad.position[1], pz + dirZ * candidateGap]),
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
  const fallbackMaxGap =
    prev.position[1] < STARTER_GUIDE_Y
      ? STARTER_MAX_LATERAL
      : Math.min(MAX_SUCCESSOR_LATERAL, 9 + prev.position[1] / 100);
  const fallbackGap = clamp(
    predictedLandingGap(prev, pad, profile),
    minLegalLateral,
    fallbackMaxGap,
  );
  result = withPosition(
    {
      ...pad,
      width: Math.max(pad.width, profile.minFootprint),
      depth: Math.max(pad.depth, profile.minFootprint),
    },
    [px + dirX * fallbackGap, fallbackY, pz + dirZ * fallbackGap],
  );
  result = widenForHumanMargin(prev, result, profile);
  const proof = proveAt(result);
  if (!proof) {
    const finalGap = Math.hypot(
      result.position[0] - prev.position[0],
      result.position[2] - prev.position[2],
    );
    throw new Error(
      `Unable to certify golden path ${prev.type}->${result.type} from y=${prev.position[1].toFixed(2)} to y=${result.position[1].toFixed(2)} gap=${finalGap.toFixed(2)} footprint=${Math.max(result.width, result.depth).toFixed(2)} route=${prev.routeIndex ?? "?"} angle=${prev.cantAngleRad?.toFixed(2) ?? "flat"}`,
    );
  }
  attachProof(proof);
  return result;
}

/**
 * Generate trampolines (and crystals) from `fromY` up to at least `targetY`.
 * Candidate types are seeded and weighted; accepted routes are decided by certified
 * parabola variants, not a fixed follow-pattern.
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
  /** Previous pad, so we can cant it toward this one (golden-path reachability). Threaded in
   *  from the prior chunk's lastPad so canting reaches across the chunk boundary. */
  let prev: TrampolineSpec | null = prevPad;
  let lastRouteDir: readonly [number, number] | null = prevPad?.incomingDir ?? null;
  const openingTurnSign = rng.next() < 0.5 ? -1 : 1;

  while (y < targetY) {
    const routeIndex = (prev?.routeIndex ?? 0) + 1;
    const sourceY = prev?.position[1] ?? y;
    const profile = routeProfile(effectiveRouteDifficulty(difficulty, sourceY));
    // Vertical spacing GROWS with altitude (difficulty curve): gaps widen from ~7.5m low to
    // ~15m higher, so the climb demands more launch commitment as it goes. Capped under the
    // canted-launch apex so a tilted certified parabola can still clear the next pad.
    const spacingBoost = Math.min(1, y / 600) * 3;
    const starterBand = prev !== null && prev.position[1] < STARTER_GUIDE_Y;
    const rawStepY = starterBand
      ? STARTER_MIN_STEP_Y + rng.next() * STARTER_STEP_SPREAD
      : 7.5 + spacingBoost + rng.next() * 6.8;
    const sourceMaxStepY = prev
      ? Math.max(5.8, (sourceLateralForProof(prev, profile).up * CLIMB_SPEED) ** 2 / (2 * G) - 1.6)
      : MAX_GOLDEN_STEP_Y;
    const routeMaxStepY = Math.min(
      profile.compressedEvery > 0 && routeIndex % profile.compressedEvery === 0
        ? profile.compressedMaxStepY
        : MAX_GOLDEN_STEP_Y,
      sourceMaxStepY,
    );
    const stepY = starterBand
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
    let width = (5.8 + rng.next() * 2.8) * diff * profile.footprintScale;
    let depth = (5.8 + rng.next() * 2.8) * diff * profile.footprintScale;
    // Shape variety: ~1 in 4 pads gets a distinct silhouette — a long plank (wide+thin) or a
    // beam (deep+narrow) — so the tower isn't a stack of identical squares (and the footprint
    // affects how you must land). The other axis shrinks to keep the area sane.
    const shapeRoll = rng.next();
    if (shapeRoll > 1 - profile.shapeVariety / 2) {
      width *= 1.55;
      depth *= 0.6;
    } else if (shapeRoll > 1 - profile.shapeVariety) {
      depth *= 1.55;
      width *= 0.6;
    }
    width = Math.max(width, profile.minFootprint);
    depth = Math.max(depth, profile.minFootprint);

    // Candidate type is weighted by difficulty, but never by a fixed follow-pattern. The
    // parabola verifier below is the actual gate: if the source cannot prove the required
    // number of impact-zone variants, the pair is reshaped or the source mechanic changes.
    let type: TrampType = weightedPadType(rng, profile);
    if (profile.difficulty === "ready" && type === "moving") type = "canted";
    if (profile.difficulty === "ready" && starterBand && routeIndex <= 5 && prev) {
      type = starterVisiblePadType(rng, prev.type, type);
    }

    if (prev) {
      [x, y, z] = separatedSuccessorPosition(prev, [x, y, z], angle);
    }

    if (prev && prev.position[1] < STARTER_GUIDE_Y) {
      [x, y, z] = starterGuidePosition(prev, [x, y, z], angle);
      width = Math.max(width, STARTER_MIN_FOOTPRINT);
      depth = Math.max(depth, STARTER_MIN_FOOTPRINT);
    }

    if (prev) {
      [x, y, z] = constrainRouteTurn(
        prev,
        [x, y, z],
        lastRouteDir,
        profile,
        routeIndex,
        openingTurnSign,
      );
    }

    // GOLDEN-PATH REACHABILITY: GUARANTEE the previous pad has a stored, screenshotable
    // parabola to this one. The fixup is constructive (no silent fall-through): try weighted
    // source mechanics, require the difficulty's proof-variant count, then reshape the target
    // only within legal readability limits. The result must preserve lateral separation and
    // attach `prev.goldenPath`.
    if (prev) {
      const fixed = ensureReachable(
        prev,
        { id: y, routeIndex, position: [x, y, z], width, depth, type },
        profile,
        rng,
      );
      x = fixed.position[0];
      y = fixed.position[1];
      z = fixed.position[2];
      width = fixed.width;
      depth = fixed.depth;
      type = fixed.type;
    }

    // id = the pad's generation Y (strictly increasing across the whole tower → unique).
    const incomingDir = prev ? aimToPosition(prev, [x, y, z]) : undefined;
    const pad: TrampolineSpec = {
      id: y,
      routeIndex,
      position: [x, y, z],
      width,
      depth,
      type,
      incomingDir,
    };
    trampolines.push(pad);
    if (incomingDir) lastRouteDir = incomingDir;
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
