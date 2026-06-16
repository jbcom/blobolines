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
  /** All-time best composite SCORE (height + crystals + combo style), persisted separately
   *  from bestHeight — you can set a score record on a shorter run with more crystals/combo. */
  bestScore: number;
  crystals: number;
  skin: BlobSkin;
  unlockedSkins: BlobSkin[];
  /** Has the player seen the first-run drag-to-launch coachmark? Set true on first launch. */
  tutorialSeen: boolean;
}

/** User-tunable settings. */
export interface GameSettings {
  masterVolume: number;
  /** SFX channel volume [0,1], independent of music. */
  sfxVolume: number;
  musicEnabled: boolean;
  slingshotSensitivity: number;
  haptics: boolean;
  /** Force reduced motion in-app (on top of the OS preference). */
  reducedMotion: boolean;
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
  /** Stable unique id (the pad's generation Y, which strictly increases up the tower).
   *  Used as the React key so the render window can prune low pads without remounting. */
  id: number;
  position: Vec3;
  width: number;
  depth: number;
  type: TrampType;
  /** Lateral cant direction for "canted" pads: unit [x,z] the pad tilts toward (the world
   *  generator points it at the next pad so the bounce carries the blob there). Omitted /
   *  zero = flat. */
  cant?: readonly [number, number];
}

export const GAME_PHASES = ["menu", "playing", "gameover"] as const;
export const POWERUP_TYPES = ["magnet", "thruster"] as const;
export const EYE_EXPRESSIONS = ["idle", "blink", "squint", "wide", "tear"] as const;
