import type { TrampType, WorldDifficulty } from "@/core/types";

export interface RouteDifficultyProfile {
  difficulty: WorldDifficulty;
  label: string;
  minLipClearance: number;
  minLipClearanceRatio: number;
  minLandingPrecision: number;
  allowFlatToFlat: boolean;
  flatToFlatMinLipClearance: number;
  flatToFlatMinLandingPrecision: number;
  compressedEvery: number;
  compressedMaxStepY: number;
  cantAnglesRad: readonly number[];
  pattern: readonly TrampType[];
}

const BASE_PATTERN: readonly TrampType[] = [
  "moving",
  "canted",
  "standard",
  "wobbler",
  "standard",
  "moving",
  "canted",
  "standard",
  "booster",
  "standard",
  "ice",
  "standard",
  "super",
  "moving",
  "standard",
  "fragile",
  "standard",
];

export const ROUTE_DIFFICULTIES: readonly WorldDifficulty[] = [
  "ready",
  "medium",
  "hard",
  "blobmare",
  "ultraBlobmare",
];

export const ROUTE_PROFILES: Record<WorldDifficulty, RouteDifficultyProfile> = {
  ready: {
    difficulty: "ready",
    label: "Ready",
    minLipClearance: 1.25,
    minLipClearanceRatio: 0.34,
    minLandingPrecision: 0.34,
    allowFlatToFlat: false,
    flatToFlatMinLipClearance: 2.4,
    flatToFlatMinLandingPrecision: 0.56,
    compressedEvery: 0,
    compressedMaxStepY: 8.8,
    cantAnglesRad: [0.34, 0.39, 0.43],
    pattern: BASE_PATTERN,
  },
  medium: {
    difficulty: "medium",
    label: "Medium",
    minLipClearance: 0.95,
    minLipClearanceRatio: 0.26,
    minLandingPrecision: 0.26,
    allowFlatToFlat: false,
    flatToFlatMinLipClearance: 1.8,
    flatToFlatMinLandingPrecision: 0.45,
    compressedEvery: 9,
    compressedMaxStepY: 8.2,
    cantAnglesRad: [0.36, 0.42, 0.48],
    pattern: [
      "moving",
      "canted",
      "standard",
      "moving",
      "wobbler",
      "standard",
      "canted",
      "canted",
      "standard",
      "booster",
      "ice",
      "moving",
      "standard",
      "super",
      "wobbler",
      "standard",
      "fragile",
    ],
  },
  hard: {
    difficulty: "hard",
    label: "Hard",
    minLipClearance: 0.7,
    minLipClearanceRatio: 0.19,
    minLandingPrecision: 0.2,
    allowFlatToFlat: true,
    flatToFlatMinLipClearance: 1.25,
    flatToFlatMinLandingPrecision: 0.34,
    compressedEvery: 6,
    compressedMaxStepY: 7.4,
    cantAnglesRad: [0.32, 0.42, 0.52],
    pattern: [
      "moving",
      "canted",
      "canted",
      "standard",
      "wobbler",
      "standard",
      "standard",
      "moving",
      "canted",
      "standard",
      "ice",
      "booster",
      "standard",
      "super",
      "fragile",
      "standard",
    ],
  },
  blobmare: {
    difficulty: "blobmare",
    label: "Blobmare",
    minLipClearance: 0.45,
    minLipClearanceRatio: 0.12,
    minLandingPrecision: 0.13,
    allowFlatToFlat: true,
    flatToFlatMinLipClearance: 0.75,
    flatToFlatMinLandingPrecision: 0.22,
    compressedEvery: 4,
    compressedMaxStepY: 6.6,
    cantAnglesRad: [0.28, 0.38, 0.5, 0.56],
    pattern: [
      "standard",
      "moving",
      "canted",
      "canted",
      "standard",
      "wobbler",
      "standard",
      "standard",
      "moving",
      "canted",
      "standard",
      "ice",
      "fragile",
      "booster",
      "standard",
      "super",
    ],
  },
  ultraBlobmare: {
    difficulty: "ultraBlobmare",
    label: "Ultra Blobmare",
    minLipClearance: 0.24,
    minLipClearanceRatio: 0.07,
    minLandingPrecision: 0.08,
    allowFlatToFlat: true,
    flatToFlatMinLipClearance: 0.38,
    flatToFlatMinLandingPrecision: 0.12,
    compressedEvery: 3,
    compressedMaxStepY: 5.9,
    cantAnglesRad: [0.24, 0.34, 0.46, 0.58],
    pattern: [
      "standard",
      "standard",
      "canted",
      "canted",
      "standard",
      "moving",
      "standard",
      "wobbler",
      "canted",
      "standard",
      "ice",
      "fragile",
      "standard",
      "booster",
      "super",
    ],
  },
};

export function routeProfile(difficulty: WorldDifficulty): RouteDifficultyProfile {
  return ROUTE_PROFILES[difficulty];
}

export function routePadType(profile: RouteDifficultyProfile, routeIndex: number): TrampType {
  return profile.pattern[(routeIndex - 1) % profile.pattern.length] ?? "standard";
}

export function routeCantAngle(profile: RouteDifficultyProfile, routeIndex: number): number {
  return profile.cantAnglesRad[routeIndex % profile.cantAnglesRad.length] ?? 0.42;
}
