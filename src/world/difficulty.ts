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
  proofVariants: number;
  footprintScale: number;
  minFootprint: number;
  shapeVariety: number;
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
  "oneWrongMove",
];

export const ROUTE_PROFILES: Record<WorldDifficulty, RouteDifficultyProfile> = {
  ready: {
    difficulty: "ready",
    label: "Easy",
    minLipClearance: 1.25,
    minLipClearanceRatio: 0.34,
    minLandingPrecision: 0.34,
    allowFlatToFlat: false,
    flatToFlatMinLipClearance: 2.4,
    flatToFlatMinLandingPrecision: 0.56,
    compressedEvery: 0,
    compressedMaxStepY: 8.8,
    cantAnglesRad: [0.16, 0.2, 0.23],
    proofVariants: 3,
    footprintScale: 1.22,
    minFootprint: 7.2,
    shapeVariety: 0.12,
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
    cantAnglesRad: [0.18, 0.23, 0.27],
    proofVariants: 2,
    footprintScale: 1.08,
    minFootprint: 6.2,
    shapeVariety: 0.22,
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
    cantAnglesRad: [0.2, 0.26, 0.32],
    proofVariants: 1,
    footprintScale: 0.98,
    minFootprint: 5.1,
    shapeVariety: 0.3,
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
    cantAnglesRad: [0.22, 0.28, 0.34, 0.38],
    proofVariants: 1,
    footprintScale: 0.9,
    minFootprint: 4.3,
    shapeVariety: 0.38,
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
    cantAnglesRad: [0.24, 0.3, 0.36, 0.42],
    proofVariants: 1,
    footprintScale: 0.82,
    minFootprint: 3.6,
    shapeVariety: 0.46,
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
  oneWrongMove: {
    difficulty: "oneWrongMove",
    label: "One Wrong Move",
    minLipClearance: 0.14,
    minLipClearanceRatio: 0.04,
    minLandingPrecision: 0.05,
    allowFlatToFlat: true,
    flatToFlatMinLipClearance: 0.22,
    flatToFlatMinLandingPrecision: 0.08,
    compressedEvery: 2,
    compressedMaxStepY: 5.2,
    cantAnglesRad: [0.26, 0.32, 0.38, 0.42],
    proofVariants: 1,
    footprintScale: 0.72,
    minFootprint: 3.0,
    shapeVariety: 0.55,
    pattern: [
      "standard",
      "standard",
      "canted",
      "canted",
      "moving",
      "standard",
      "wobbler",
      "standard",
      "canted",
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
