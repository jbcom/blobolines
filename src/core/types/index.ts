/**
 * Shared domain types for Blobolines. Framework-agnostic — imported by sim, factories,
 * state, and render alike so there is one vocabulary for game concepts.
 */

import type { BlobSkin, TrampType } from "@/styles/tokens";

export type { BlobSkin, TrampType } from "@/styles/tokens";

/** High-level game lifecycle. */
export type GamePhase = "menu" | "playing" | "gameover";

/** A 3D vector as a plain tuple (sim-friendly, serializable). */
export type Vec3 = readonly [x: number, y: number, z: number];

/** The blob's expressive eye state, driven by velocity + impact. */
export type EyeExpression = "idle" | "blink" | "squint" | "wide" | "tear";

/** Power-up kinds. */
export type PowerUpType = "magnet" | "thruster";

/** Persistent player progress. */
export interface PlayerProgress {
  bestHeight: number;
  crystals: number;
  skin: BlobSkin;
  unlockedSkins: BlobSkin[];
}

/** User-tunable settings. */
export interface GameSettings {
  masterVolume: number;
  musicEnabled: boolean;
  slingshotSensitivity: number;
  haptics: boolean;
}

/** Snapshot of the blob each frame (read by render + UI; written by sim). */
export interface BlobSnapshot {
  position: Vec3;
  velocity: Vec3;
  /** 0 = resting on a trampoline, 1 = airborne. */
  airborne: boolean;
  expression: EyeExpression;
  /** Squash factor along the impact normal, 1 = round. */
  squash: number;
}

/** Trampoline descriptor used by world-gen and factories. */
export interface TrampolineSpec {
  position: Vec3;
  width: number;
  depth: number;
  type: TrampType;
}

export const GAME_PHASES = ["menu", "playing", "gameover"] as const;
export const POWERUP_TYPES = ["magnet", "thruster"] as const;
export const EYE_EXPRESSIONS = ["idle", "blink", "squint", "wide", "tear"] as const;
