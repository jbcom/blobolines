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

/** Every power-up kind — the single source of truth. magnet (pull crystals), thruster
 *  (skyward boost), shield (one-shot second-life — absorbs a fatal fall), slowmo (bullet-
 *  time — slows the sim to stretch the mid-air reaction window), doubler (score-doubler —
 *  crystals collected while active are worth double), multibounce (a stack of free mid-air
 *  bounces, spent one per airborne tap). PowerUpType derives from it so the type and the
 *  runtime list can never drift apart. */
export const POWERUP_TYPES = [
  "magnet",
  "thruster",
  "shield",
  "slowmo",
  "doubler",
  "multibounce",
] as const;
export type PowerUpType = (typeof POWERUP_TYPES)[number];

/** Crystal rarity tiers. Higher tiers are worth more crystals (and so more score), rarer,
 *  larger, and brighter — the reward for ranging off the safe line + climbing higher. */
export type CrystalTier = "common" | "rare" | "radiant";

/** Route-generation difficulty. Higher difficulties allow more precision flat arcs; lower
 *  difficulties bias the tower toward readable trampoline mechanics. */
export type WorldDifficulty =
  | "ready"
  | "medium"
  | "hard"
  | "blobmare"
  | "ultraBlobmare"
  | "oneWrongMove";

/** A generated collectible crystal: where it floats + its rarity tier. */
export interface CrystalSpec {
  position: Vec3;
  tier: CrystalTier;
}

/** Certified launch route from one trampoline to its successor. The world generator attaches
 *  this to the SOURCE pad after proving the shipped launch tuning produces a ballistic arc
 *  that lands inside the successor footprint; the dev harness can visualize it, but live play
 *  does not reveal it as the answer path. */
export interface GoldenPathVariant {
  /** Hold-release charge [0,1] that produces this certified variant. */
  launchCharge: number;
  launchSpeed: number;
  flightTime: number;
  apex: Vec3;
  landing: Vec3;
  clearance: number;
  samples: Vec3[];
  landingPrecision: number;
  lipClearance: number;
  lipClearanceRatio: number;
  arcCompression: number;
}

export type RouteGateKind = "phasePortal";

/** A route obstacle anchored to a certified golden path. Gates are generated from proof
 *  samples, so seed verification can prove they are placed on the playable route instead of
 *  floating as decorative hazards. */
export interface RouteGateSpec {
  id: string;
  kind: RouteGateKind;
  sourcePadId: number;
  targetPadId: number;
  routeIndex: number;
  /** Index into the source proof's world-space sample array. */
  sampleIndex: number;
  /** World-space obstacle center. */
  position: Vec3;
  /** Horizontal unit vector the vertical gate faces along. */
  normal: Vec3;
  /** Contact radius in metres. */
  radius: number;
  /** Seconds per open/closed cycle. */
  period: number;
  /** 0..1 share of the period where the gate is passable. */
  openFraction: number;
  /** Normalized cycle offset. */
  phaseOffset: number;
  /** Seconds after launch when the certified path reaches this gate sample. */
  flightTime: number;
  /** Deterministic fair-release wait that lands the proof inside an open window. */
  idealReleaseDelay: number;
}

export interface GoldenPathProof {
  /** Successor pad id this proof lands on. */
  toPadId: number;
  /** Unit launch normal used for the bounce. Flat pads use [0,1,0]; canted pads tilt. */
  launchNormal: Vec3;
  /** Launch speed used by the proof. */
  launchSpeed: number;
  /** Hold-release charge [0,1] that produces this certified proof. */
  launchCharge: number;
  /** Seconds from launch to the first crossing of the successor pad's height. */
  flightTime: number;
  /** Highest point reached by the certified parabola. */
  apex: Vec3;
  /** Ballistic point at the successor height; must be inside the successor footprint. */
  landing: Vec3;
  /** Non-negative margin between the ballistic landing miss and the successor half-footprint. */
  clearance: number;
  /** World-space samples along the certified parabola, for dev proof rendering/screenshots. */
  samples: Vec3[];
  /** Whether the generator had to promote the source pad from flat to canted. */
  requiredCant: boolean;
  /** Source mechanic used by the proof arc. */
  sourceMode: "flat" | "canted" | "moving" | "wobbler";
  /** Radians away from straight-up used by the certified launch. */
  launchAngleRad: number;
  /** 0..1, where 1 lands at target center and 0 lands exactly on the legal lip. */
  landingPrecision: number;
  /** Meters between the ballistic landing and the target lip. */
  lipClearance: number;
  /** Lip clearance as a share of the target half-footprint. */
  lipClearanceRatio: number;
  /** 0..1, higher means a tighter, lower-apex compressed arc. */
  arcCompression: number;
  /** Accepted launch-speed variants that still hit the successor impact zone. Includes the
   *  primary golden path as item 0. Easy stores three, Medium two, harder modes one. */
  variants?: GoldenPathVariant[];
  /** Optional route obstacle placed directly on this certified proof. */
  routeGate?: RouteGateSpec;
}

/** Persistent player progress. */
export interface PlayerProgress {
  bestHeight: number;
  /** All-time best composite SCORE (height + crystals + combo style), persisted separately
   *  from bestHeight — you can set a score record on a shorter run with more crystals/combo. */
  bestScore: number;
  crystals: number;
  skin: BlobSkin;
  unlockedSkins: BlobSkin[];
  /** Has the player seen the first-run hold-to-launch coachmark? Set true on first launch. */
  tutorialSeen: boolean;
  /** Ids of unlocked achievements (src/sim/achievements). Persisted; keyed by id so adding or
   *  reordering achievements never disturbs existing unlocks. */
  unlockedAchievements: string[];
}

/** User-tunable settings. */
export interface GameSettings {
  masterVolume: number;
  /** SFX bus volume [0,1], independent of music/ambient. */
  sfxVolume: number;
  /** Music bus volume [0,1]. */
  musicVolume: number;
  /** Ambient bed bus volume [0,1]. */
  ambientVolume: number;
  musicEnabled: boolean;
  /** Charge fill speed multiplier for hold-release launches. */
  chargeSensitivity: number;
  haptics: boolean;
  /** Force reduced motion in-app (on top of the OS preference). */
  reducedMotion: boolean;
  /** Render quality preference: "auto" lets the device class + FPS pick the tier; an explicit
   *  tier pins it (force Low to save battery, or High on a capable device). Kept as a string
   *  literal here (not imported from render/quality) so core/types stays dependency-light;
   *  render/quality's QualityPref is the same union. */
  qualityPref: "auto" | "low" | "medium" | "high";
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
  /** Optional per-pad cant strength. Harder routes vary this instead of using one fixed angle. */
  cantAngleRad?: number;
  /** Unit lateral slide axis for moving pads. The generator aims it at the certified
   *  successor so a timed catch can follow the red proof arc. */
  moveAxis?: readonly [number, number];
  /** Monotonic route order. The starter is 0; each successor increments by one. */
  routeIndex?: number;
  /** Unit [x,z] direction from the previous route pad into this one. Stored so incremental
   *  generation can keep route turns readable across chunk boundaries. */
  incomingDir?: readonly [number, number];
  /** Certified route from this pad to its immediate successor. Omitted only for the highest
   *  generated tail pad until the next chunk attaches its successor. */
  goldenPath?: GoldenPathProof;
}

export const GAME_PHASES = ["menu", "playing", "gameover"] as const;
export const EYE_EXPRESSIONS = ["idle", "blink", "squint", "wide", "tear"] as const;
