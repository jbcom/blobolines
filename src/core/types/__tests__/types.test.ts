import { describe, expect, it } from "vitest";
import {
  type BlobSnapshot,
  EYE_EXPRESSIONS,
  GAME_PHASES,
  type GamePhase,
  type GameSettings,
  type PlayerProgress,
  POWERUP_TYPES,
  type TrampolineSpec,
} from "..";

describe("domain types", () => {
  it("GAME_PHASES covers all phases", () => {
    expect(GAME_PHASES).toEqual(["menu", "playing", "gameover"]);
  });

  it("POWERUP_TYPES covers all powerups", () => {
    expect(POWERUP_TYPES).toEqual([
      "magnet",
      "thruster",
      "shield",
      "slowmo",
      "doubler",
      "multibounce",
    ]);
  });

  it("EYE_EXPRESSIONS covers all expressions", () => {
    expect(EYE_EXPRESSIONS).toEqual(["idle", "blink", "squint", "wide", "tear"]);
  });

  it("GamePhase values are a subset of GAME_PHASES", () => {
    const phase: GamePhase = "playing";
    expect(GAME_PHASES).toContain(phase);
  });

  it("PlayerProgress shape is valid", () => {
    const p: PlayerProgress = {
      bestHeight: 100,
      bestScore: 1200,
      crystals: 5,
      skin: "blue",
      unlockedSkins: ["blue", "slime"],
      tutorialSeen: true,
      unlockedAchievements: ["height-100"],
    };
    expect(p.bestHeight).toBe(100);
    expect(p.unlockedSkins).toHaveLength(2);
  });

  it("GameSettings defaults are sensible", () => {
    const s: GameSettings = {
      masterVolume: 0.8,
      sfxVolume: 0.9,
      musicVolume: 0.8,
      ambientVolume: 0.7,
      musicEnabled: true,
      slingshotSensitivity: 1,
      haptics: true,
      reducedMotion: false,
      qualityPref: "auto",
    };
    expect(s.masterVolume).toBeGreaterThan(0);
    expect(s.masterVolume).toBeLessThanOrEqual(1);
    // Every audio bus level is a sane [0,1].
    for (const v of [s.sfxVolume, s.musicVolume, s.ambientVolume]) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it("BlobSnapshot can represent airborne blob", () => {
    const snap: BlobSnapshot = {
      position: [0, 10, 0],
      velocity: [0, 5, 0],
      airborne: true,
      expression: "wide",
      squash: 1,
    };
    expect(snap.airborne).toBe(true);
    expect(snap.expression).toBe("wide");
  });

  it("TrampolineSpec can represent a booster trampoline", () => {
    const t: TrampolineSpec = {
      id: 5,
      position: [2, 5, 0],
      width: 3,
      depth: 2,
      type: "booster",
    };
    expect(t.type).toBe("booster");
  });
});
