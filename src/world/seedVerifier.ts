import { createRng, type SeedInput } from "@/core/math";
import type { GoldenPathProof, RouteGateSpec, TrampolineSpec, WorldDifficulty } from "@/core/types";
import {
  difficultyRank,
  effectiveRouteDifficulty,
  ROUTE_DIFFICULTIES,
  routeProfile,
} from "./difficulty";
import { generateUpTo, starterPad } from "./generator";
import { solveGoldenPath } from "./reachable";
import { phasePortalOpen } from "./routeGate";

export interface SeedRouteVerificationOptions {
  seed: SeedInput;
  difficulty?: WorldDifficulty;
  targetY?: number;
}

export interface SeedRouteFailure {
  pairIndex: number;
  sourceId: number;
  targetId: number;
  reason: string;
}

export interface SeedRouteVerification {
  ok: boolean;
  seed: number;
  seedPhrase: string;
  difficulty: WorldDifficulty;
  difficultyLabel: string;
  targetY: number;
  highestY: number;
  padCount: number;
  pairCount: number;
  minRequiredProofVariants: number;
  maxRequiredProofVariants: number;
  requiredProofVariants: number;
  minProofVariants: number;
  maxProofVariants: number;
  routeGateCount: number;
  phasePortalCount: number;
  minLateralGap: number;
  minLipClearance: number;
  minLandingPrecision: number;
  sourceModes: Record<GoldenPathProof["sourceMode"], number>;
  failures: SeedRouteFailure[];
}

const DEFAULT_TARGET_Y = 5000;
const MIN_READABLE_LATERAL = 3.4;
const EPS = 1e-5;

function lateralGap(a: TrampolineSpec, b: TrampolineSpec): number {
  return Math.hypot(b.position[0] - a.position[0], b.position[2] - a.position[2]);
}

function finalSampleDelta(proof: GoldenPathProof): number {
  const impact = proof.samples.at(-1);
  if (!impact) return Number.POSITIVE_INFINITY;
  return Math.hypot(
    impact[0] - proof.landing[0],
    impact[1] - proof.landing[1],
    impact[2] - proof.landing[2],
  );
}

function variantFinalSampleDelta(
  variant: NonNullable<GoldenPathProof["variants"]>[number],
): number {
  const impact = variant.samples.at(-1);
  if (!impact) return Number.POSITIVE_INFINITY;
  return Math.hypot(
    impact[0] - variant.landing[0],
    impact[1] - variant.landing[1],
    impact[2] - variant.landing[2],
  );
}

function landingMiss(proof: GoldenPathProof, target: TrampolineSpec): number {
  return Math.hypot(proof.landing[0] - target.position[0], proof.landing[2] - target.position[2]);
}

function variantLandingMiss(
  variant: NonNullable<GoldenPathProof["variants"]>[number],
  target: TrampolineSpec,
): number {
  return Math.hypot(
    variant.landing[0] - target.position[0],
    variant.landing[2] - target.position[2],
  );
}

function gateSampleDelta(gate: RouteGateSpec, proof: GoldenPathProof): number {
  const sample = proof.samples[gate.sampleIndex];
  if (!sample) return Number.POSITIVE_INFINITY;
  return Math.hypot(
    sample[0] - gate.position[0],
    sample[1] - gate.position[1],
    sample[2] - gate.position[2],
  );
}

function expectedSourceMode(source: TrampolineSpec): GoldenPathProof["sourceMode"] | null {
  if (source.type === "standard") return "flat";
  if (source.type === "canted") return "canted";
  if (source.type === "moving") return "moving";
  if (source.type === "wobbler") return "wobbler";
  return null;
}

function addFailure(
  failures: SeedRouteFailure[],
  pairIndex: number,
  source: TrampolineSpec,
  target: TrampolineSpec,
  reason: string,
) {
  failures.push({ pairIndex, sourceId: source.id, targetId: target.id, reason });
}

export function verifySeedRoute({
  seed,
  difficulty = "ready",
  targetY = DEFAULT_TARGET_Y,
}: SeedRouteVerificationOptions): SeedRouteVerification {
  if (!ROUTE_DIFFICULTIES.includes(difficulty)) {
    throw new Error(`verifySeedRoute: unknown difficulty "${difficulty}"`);
  }
  if (!Number.isFinite(targetY) || targetY <= 0) {
    throw new Error(`verifySeedRoute: targetY must be positive, got ${targetY}`);
  }

  const rng = createRng(seed);
  const start = starterPad();
  const chunk = generateUpTo(rng, 0, targetY, start, difficulty);
  const pads = [start, ...chunk.trampolines];
  const failures: SeedRouteFailure[] = [];
  const sourceModes: SeedRouteVerification["sourceModes"] = {
    flat: 0,
    canted: 0,
    moving: 0,
    wobbler: 0,
  };
  let minLateralGap = Number.POSITIVE_INFINITY;
  let minLipClearance = Number.POSITIVE_INFINITY;
  let minLandingPrecision = Number.POSITIVE_INFINITY;
  let minProofVariants = Number.POSITIVE_INFINITY;
  let maxProofVariants = 0;
  let minRequiredProofVariants = Number.POSITIVE_INFINITY;
  let maxRequiredProofVariants = 0;
  let routeGateCount = 0;
  let phasePortalCount = 0;

  for (let i = 0; i < pads.length - 1; i++) {
    const source = pads[i];
    const target = pads[i + 1];
    const activeProfile = routeProfile(effectiveRouteDifficulty(difficulty, source.position[1]));
    const proof = source.goldenPath;
    const gap = lateralGap(source, target);
    minLateralGap = Math.min(minLateralGap, gap);
    minRequiredProofVariants = Math.min(minRequiredProofVariants, activeProfile.proofVariants);
    maxRequiredProofVariants = Math.max(maxRequiredProofVariants, activeProfile.proofVariants);

    if (target.position[1] <= source.position[1]) {
      addFailure(failures, i, source, target, "target does not climb above source");
    }
    if (gap + EPS < MIN_READABLE_LATERAL) {
      addFailure(failures, i, source, target, "successor collapsed into an overhead stack");
    }
    if (!proof) {
      addFailure(failures, i, source, target, "missing stored goldenPath proof");
      continue;
    }

    sourceModes[proof.sourceMode]++;
    const variants = proof.variants ?? [];
    minProofVariants = Math.min(minProofVariants, variants.length);
    maxProofVariants = Math.max(maxProofVariants, variants.length);
    minLipClearance = Math.min(minLipClearance, proof.lipClearance);
    minLandingPrecision = Math.min(minLandingPrecision, proof.landingPrecision);

    if (proof.toPadId !== target.id) {
      addFailure(failures, i, source, target, "proof points at the wrong successor");
    }
    const expectedMode = expectedSourceMode(source);
    if (!expectedMode) {
      addFailure(failures, i, source, target, "unsupported pad type stored as proof source");
    } else if (proof.sourceMode !== expectedMode) {
      addFailure(failures, i, source, target, "proof source mode does not match pad mechanic");
    }
    if (variants.length !== activeProfile.proofVariants) {
      addFailure(
        failures,
        i,
        source,
        target,
        `proof variant count ${variants.length} does not match difficulty requirement ${activeProfile.proofVariants}`,
      );
    }
    if (proof.samples.length < 12) {
      addFailure(failures, i, source, target, "proof does not have enough visible samples");
    }
    if (finalSampleDelta(proof) > EPS) {
      addFailure(failures, i, source, target, "final sample is not the certified impact point");
    }
    if (proof.apex[1] <= proof.landing[1] + 0.001) {
      addFailure(failures, i, source, target, "proof never descends into the successor");
    }
    if (proof.lipClearance < -EPS || proof.landingPrecision < -EPS) {
      addFailure(failures, i, source, target, "proof lands outside the target footprint");
    }
    const halfFoot = Math.max(target.width, target.depth) * 0.5;
    if (landingMiss(proof, target) > halfFoot + EPS) {
      addFailure(failures, i, source, target, "stored landing is outside successor footprint");
    }
    for (let variantIndex = 0; variantIndex < variants.length; variantIndex++) {
      const variant = variants[variantIndex];
      if (variant.samples.length < 12) {
        addFailure(
          failures,
          i,
          source,
          target,
          `proof variant ${variantIndex} does not have enough visible samples`,
        );
      }
      if (variantFinalSampleDelta(variant) > EPS) {
        addFailure(
          failures,
          i,
          source,
          target,
          `proof variant ${variantIndex} final sample is not the impact point`,
        );
      }
      if (variant.lipClearance < -EPS || variant.landingPrecision < -EPS) {
        addFailure(
          failures,
          i,
          source,
          target,
          `proof variant ${variantIndex} lands outside the target footprint`,
        );
      }
      if (variantLandingMiss(variant, target) > halfFoot + EPS) {
        addFailure(
          failures,
          i,
          source,
          target,
          `proof variant ${variantIndex} stored landing is outside successor footprint`,
        );
      }
    }

    const gate = proof.routeGate;
    if (gate) {
      routeGateCount++;
      if (gate.kind === "phasePortal") phasePortalCount++;
      if (difficultyRank(activeProfile.difficulty) < difficultyRank("ultraBlobmare")) {
        addFailure(failures, i, source, target, "route gate appeared before Ultra Blobmare");
      }
      if (gate.sourcePadId !== source.id || gate.targetPadId !== target.id) {
        addFailure(failures, i, source, target, "route gate points at the wrong pad pair");
      }
      if (gate.sampleIndex < 0 || gate.sampleIndex >= proof.samples.length) {
        addFailure(failures, i, source, target, "route gate sample index is outside the proof");
      } else if (gateSampleDelta(gate, proof) > EPS) {
        addFailure(failures, i, source, target, "route gate is not anchored to a proof sample");
      }
      if (
        gate.radius <= 0 ||
        gate.period <= 0 ||
        gate.openFraction <= 0 ||
        gate.openFraction >= 1
      ) {
        addFailure(failures, i, source, target, "route gate timing or radius is invalid");
      }
      if (!phasePortalOpen(gate, gate.idealReleaseDelay + gate.flightTime)) {
        addFailure(failures, i, source, target, "route gate has no certified open timing");
      }
    }

    const replayed = solveGoldenPath(
      source,
      target,
      proof.launchSpeed,
      undefined,
      undefined,
      proof.requiredCant,
      proof.sourceMode,
    );
    if (!replayed) {
      addFailure(failures, i, source, target, "stored launch speed no longer replays");
    } else if (
      Math.hypot(replayed.landing[0] - proof.landing[0], replayed.landing[2] - proof.landing[2]) >
      EPS
    ) {
      addFailure(failures, i, source, target, "replayed proof lands at a different point");
    }
  }

  return {
    ok: failures.length === 0,
    seed: rng.seed,
    seedPhrase: rng.phrase,
    difficulty,
    difficultyLabel: routeProfile(difficulty).label,
    targetY,
    highestY: chunk.highestY,
    padCount: pads.length,
    pairCount: Math.max(0, pads.length - 1),
    minRequiredProofVariants: Number.isFinite(minRequiredProofVariants)
      ? minRequiredProofVariants
      : 0,
    maxRequiredProofVariants,
    requiredProofVariants: maxRequiredProofVariants,
    minProofVariants: Number.isFinite(minProofVariants) ? minProofVariants : 0,
    maxProofVariants,
    routeGateCount,
    phasePortalCount,
    minLateralGap: Number.isFinite(minLateralGap) ? minLateralGap : 0,
    minLipClearance: Number.isFinite(minLipClearance) ? minLipClearance : 0,
    minLandingPrecision: Number.isFinite(minLandingPrecision) ? minLandingPrecision : 0,
    sourceModes,
    failures,
  };
}
