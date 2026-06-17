import type { TrampType, WorldDifficulty } from "@/core/types";

export interface RouteDifficultyProfile {
  difficulty: WorldDifficulty;
  label: string;
  minLipClearance: number;
  minLipClearanceRatio: number;
  minLandingPrecision: number;
  compressedEvery: number;
  compressedMaxStepY: number;
  cantAnglesRad: readonly number[];
  proofVariants: number;
  proofVariantSpread: number;
  footprintScale: number;
  minFootprint: number;
  shapeVariety: number;
  typeWeights: Partial<Record<TrampType, number>>;
}

export interface RouteDifficultyProgress {
  starting: WorldDifficulty;
  current: WorldDifficulty;
  next: WorldDifficulty | null;
  /** 0-based active tier index in ROUTE_DIFFICULTIES. */
  currentIndex: number;
  /** Metres where the current tier began for this run's selected starting difficulty. */
  tierStartMeters: number;
  /** Metres where the next tier begins, or null when already at the final tier. */
  nextAtMeters: number | null;
  /** Metres climbed inside the current tier. */
  metersIntoTier: number;
  /** Metres until the next tier, or 0 when already at the final tier. */
  metersToNext: number;
  /** 0..1 progress through the current tier's altitude band. */
  progress: number;
}

export const ROUTE_DIFFICULTIES: readonly WorldDifficulty[] = [
  "ready",
  "medium",
  "hard",
  "blobmare",
  "ultraBlobmare",
  "oneWrongMove",
];

const DIFFICULTY_ORDER = new Map<WorldDifficulty, number>(
  ROUTE_DIFFICULTIES.map((difficulty, index) => [difficulty, index]),
);

export function difficultyRank(difficulty: WorldDifficulty): number {
  return DIFFICULTY_ORDER.get(difficulty) ?? 0;
}

const PROGRESSION_METERS: Record<WorldDifficulty, readonly number[]> = {
  ready: [0, 520, 1200, 2200, 3600, 5600],
  medium: [0, 680, 1650, 3100, 5200],
  hard: [0, 900, 2300, 4300],
  blobmare: [0, 1300, 3400],
  ultraBlobmare: [0, 1800],
  oneWrongMove: [0],
};

export const ROUTE_PROFILES: Record<WorldDifficulty, RouteDifficultyProfile> = {
  ready: {
    difficulty: "ready",
    label: "Easy",
    minLipClearance: 1.25,
    minLipClearanceRatio: 0.34,
    minLandingPrecision: 0.34,
    compressedEvery: 0,
    compressedMaxStepY: 8.8,
    cantAnglesRad: [0.26, 0.3, 0.34],
    proofVariants: 3,
    proofVariantSpread: 0.045,
    footprintScale: 1.22,
    minFootprint: 7.2,
    shapeVariety: 0.12,
    typeWeights: {
      standard: 0.55,
      moving: 2,
      canted: 2.15,
      wobbler: 1.5,
      booster: 0.45,
      ice: 0.25,
      super: 0.18,
      fragile: 0.05,
    },
  },
  medium: {
    difficulty: "medium",
    label: "Medium",
    minLipClearance: 0.95,
    minLipClearanceRatio: 0.26,
    minLandingPrecision: 0.26,
    compressedEvery: 9,
    compressedMaxStepY: 8.2,
    cantAnglesRad: [0.28, 0.33, 0.38],
    proofVariants: 2,
    proofVariantSpread: 0.065,
    footprintScale: 1.08,
    minFootprint: 6.2,
    shapeVariety: 0.22,
    typeWeights: {
      standard: 2,
      moving: 1.35,
      canted: 1.55,
      wobbler: 1,
      booster: 0.55,
      ice: 0.45,
      super: 0.25,
      fragile: 0.22,
    },
  },
  hard: {
    difficulty: "hard",
    label: "Hard",
    minLipClearance: 0.7,
    minLipClearanceRatio: 0.19,
    minLandingPrecision: 0.2,
    compressedEvery: 6,
    compressedMaxStepY: 7.4,
    cantAnglesRad: [0.3, 0.36, 0.42],
    proofVariants: 1,
    proofVariantSpread: 0.035,
    footprintScale: 0.98,
    minFootprint: 5.1,
    shapeVariety: 0.3,
    typeWeights: {
      standard: 2.25,
      moving: 1.15,
      canted: 1.5,
      wobbler: 1.05,
      booster: 0.6,
      ice: 0.55,
      super: 0.3,
      fragile: 0.45,
    },
  },
  blobmare: {
    difficulty: "blobmare",
    label: "Blobmare",
    minLipClearance: 0.45,
    minLipClearanceRatio: 0.12,
    minLandingPrecision: 0.13,
    compressedEvery: 4,
    compressedMaxStepY: 6.6,
    cantAnglesRad: [0.32, 0.38, 0.44, 0.5],
    proofVariants: 1,
    proofVariantSpread: 0.02,
    footprintScale: 0.9,
    minFootprint: 4.3,
    shapeVariety: 0.38,
    typeWeights: {
      standard: 2.35,
      moving: 1,
      canted: 1.45,
      wobbler: 1,
      booster: 0.7,
      ice: 0.65,
      super: 0.35,
      fragile: 0.65,
    },
  },
  ultraBlobmare: {
    difficulty: "ultraBlobmare",
    label: "Ultra Blobmare",
    minLipClearance: 0.24,
    minLipClearanceRatio: 0.07,
    minLandingPrecision: 0.08,
    compressedEvery: 3,
    compressedMaxStepY: 5.9,
    cantAnglesRad: [0.34, 0.42, 0.5, 0.56],
    proofVariants: 1,
    proofVariantSpread: 0.008,
    footprintScale: 0.82,
    minFootprint: 3.6,
    shapeVariety: 0.46,
    typeWeights: {
      standard: 2.5,
      moving: 0.8,
      canted: 1.25,
      wobbler: 0.8,
      booster: 0.75,
      ice: 0.7,
      super: 0.35,
      fragile: 0.85,
    },
  },
  oneWrongMove: {
    difficulty: "oneWrongMove",
    label: "One Wrong Move",
    minLipClearance: 0.14,
    minLipClearanceRatio: 0.04,
    minLandingPrecision: 0.05,
    compressedEvery: 2,
    compressedMaxStepY: 5.2,
    cantAnglesRad: [0.36, 0.44, 0.52, 0.58],
    proofVariants: 1,
    proofVariantSpread: 0,
    footprintScale: 0.72,
    minFootprint: 3.0,
    shapeVariety: 0.55,
    typeWeights: {
      standard: 2.6,
      moving: 0.65,
      canted: 1.1,
      wobbler: 0.65,
      booster: 0.75,
      ice: 0.75,
      super: 0.35,
      fragile: 1,
    },
  },
};

export function routeProfile(difficulty: WorldDifficulty): RouteDifficultyProfile {
  return ROUTE_PROFILES[difficulty];
}

export function routeCantAngle(profile: RouteDifficultyProfile, routeIndex: number): number {
  return profile.cantAnglesRad[routeIndex % profile.cantAnglesRad.length] ?? 0.42;
}

export function effectiveRouteDifficulty(
  startingDifficulty: WorldDifficulty,
  heightMeters: number,
): WorldDifficulty {
  return routeDifficultyProgress(startingDifficulty, heightMeters).current;
}

export function routeDifficultyProgress(
  startingDifficulty: WorldDifficulty,
  heightMeters: number,
): RouteDifficultyProgress {
  const height = Math.max(0, heightMeters);
  const startIndex = difficultyRank(startingDifficulty);
  const progression = PROGRESSION_METERS[startingDifficulty];
  let step = 0;
  for (let i = 0; i < progression.length; i++) {
    if (height >= (progression[i] ?? 0)) step = i;
  }
  const currentIndex = Math.min(ROUTE_DIFFICULTIES.length - 1, startIndex + step);
  const current = ROUTE_DIFFICULTIES[currentIndex] ?? "oneWrongMove";
  const next = ROUTE_DIFFICULTIES[currentIndex + 1] ?? null;
  const tierStartMeters = progression[step] ?? 0;
  const nextAtMeters = next ? (progression[step + 1] ?? null) : null;
  const metersIntoTier = Math.max(0, height - tierStartMeters);
  const metersToNext = nextAtMeters === null ? 0 : Math.max(0, nextAtMeters - height);
  const span = nextAtMeters === null ? 0 : Math.max(1, nextAtMeters - tierStartMeters);
  return {
    starting: startingDifficulty,
    current,
    next,
    currentIndex,
    tierStartMeters,
    nextAtMeters,
    metersIntoTier,
    metersToNext,
    progress: nextAtMeters === null ? 1 : Math.max(0, Math.min(1, metersIntoTier / span)),
  };
}
