import type {
  GoldenPathProof,
  RouteGateKind,
  RouteGateSpec,
  TrampolineSpec,
  Vec3,
  WorldDifficulty,
} from "@/core/types";
import type { RouteDifficultyProfile } from "./difficulty";

const MIN_GATE_SAMPLE_INDEX = 2;

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function wrap01(n: number): number {
  return n - Math.floor(n);
}

function hash01(a: number, b: number, c: number): number {
  const n = Math.sin(a * 12.9898 + b * 78.233 + c * 37.719) * 43758.5453123;
  return n - Math.floor(n);
}

function gateKind(difficulty: WorldDifficulty): RouteGateKind | null {
  if (difficulty === "blobmare") return "slicer";
  if (difficulty === "ultraBlobmare" || difficulty === "oneWrongMove") return "phasePortal";
  return null;
}

function gateCadence(difficulty: WorldDifficulty): number | null {
  if (difficulty === "blobmare") return 6;
  if (difficulty === "ultraBlobmare") return 5;
  if (difficulty === "oneWrongMove") return 3;
  return null;
}

function gateTuning(
  difficulty: WorldDifficulty,
): Pick<
  RouteGateSpec,
  "period" | "openFraction" | "radius" | "fragmentCount" | "splitSpread"
> | null {
  if (difficulty === "blobmare") {
    return { period: 0, openFraction: 0, radius: 1.58, fragmentCount: 3, splitSpread: 3.2 };
  }
  if (difficulty === "ultraBlobmare") {
    return { period: 2.35, openFraction: 0.42, radius: 1.65 };
  }
  if (difficulty === "oneWrongMove") {
    return { period: 1.75, openFraction: 0.28, radius: 1.38 };
  }
  return null;
}

function gateNormal(source: TrampolineSpec, target: TrampolineSpec): Vec3 {
  const dx = target.position[0] - source.position[0];
  const dz = target.position[2] - source.position[2];
  const m = Math.hypot(dx, dz);
  return m < 1e-6 ? [0, 0, 1] : [dx / m, 0, dz / m];
}

export function routeGatePhase(gate: RouteGateSpec, elapsedSeconds: number): number {
  if (gate.period <= 0) return 1;
  return wrap01(elapsedSeconds / gate.period + gate.phaseOffset);
}

export function phasePortalOpen(gate: RouteGateSpec, elapsedSeconds: number): boolean {
  return routeGatePhase(gate, elapsedSeconds) < gate.openFraction;
}

export function shouldGenerateRouteGate(
  source: TrampolineSpec,
  profile: RouteDifficultyProfile,
): boolean {
  const routeIndex = source.routeIndex ?? 0;
  const cadence = gateCadence(profile.difficulty);
  const kind = gateKind(profile.difficulty);
  if (!cadence) return false;
  if (!kind) return false;
  if (profile.difficulty === "blobmare" && routeIndex < 5) return false;
  if (profile.difficulty === "ultraBlobmare" && routeIndex < 4) return false;
  if (profile.difficulty === "oneWrongMove" && routeIndex < 2) return false;
  return routeIndex % cadence === 0;
}

export function createRouteGateForProof(
  source: TrampolineSpec,
  target: TrampolineSpec,
  proof: GoldenPathProof,
  profile: RouteDifficultyProfile,
): RouteGateSpec | null {
  if (!shouldGenerateRouteGate(source, profile)) return null;
  const tuning = gateTuning(profile.difficulty);
  if (!tuning || proof.samples.length <= MIN_GATE_SAMPLE_INDEX + 2) return null;
  const sampleDivisor = proof.samples.length - 1;
  if (sampleDivisor <= 0) return null;

  const routeIndex = source.routeIndex ?? 0;
  const kind = gateKind(profile.difficulty);
  if (!kind) return null;
  const travelFraction =
    kind === "slicer"
      ? 0.38 + hash01(source.id, target.id, routeIndex) * 0.16
      : 0.44 + hash01(source.id, target.id, routeIndex) * 0.18;
  const sampleIndex = clamp(
    Math.round((proof.samples.length - 1) * travelFraction),
    MIN_GATE_SAMPLE_INDEX,
    proof.samples.length - 2,
  );
  const sample = proof.samples[sampleIndex];
  if (!sample) return null;

  const sampleFlightTime = proof.flightTime * (sampleIndex / sampleDivisor);
  const idealReleaseDelay =
    kind === "slicer"
      ? 0
      : profile.difficulty === "oneWrongMove"
        ? 0.12 + hash01(target.id, source.id, routeIndex) * 0.28
        : 0.2 + hash01(target.id, source.id, routeIndex) * 0.5;
  const openCenter = tuning.openFraction * 0.5;
  const phaseOffset =
    kind === "slicer"
      ? 0
      : wrap01(openCenter - (idealReleaseDelay + sampleFlightTime) / tuning.period);
  const fragmentCount =
    kind === "slicer"
      ? 3 + clamp(Math.floor(hash01(target.id, source.id, routeIndex) * 3), 0, 2)
      : undefined;

  return {
    id: `${kind}-${routeIndex}-${source.id.toFixed(3)}-${target.id.toFixed(3)}`,
    kind,
    sourcePadId: source.id,
    targetPadId: target.id,
    routeIndex,
    sampleIndex,
    position: sample,
    normal: gateNormal(source, target),
    radius: tuning.radius,
    period: tuning.period,
    openFraction: tuning.openFraction,
    phaseOffset,
    flightTime: sampleFlightTime,
    idealReleaseDelay,
    fragmentCount,
    splitSpread: tuning.splitSpread,
  };
}
