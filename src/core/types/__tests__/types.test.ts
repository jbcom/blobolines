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
    expect(POWERUP_TYPES).toEqual(["magnet", "thruster"]);
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
      crystals: 5,
      skin: "blue",
      unlockedSkins: ["blue", "slime"],
    };
    expect(p.bestHeight).toBe(100);
    expect(p.unlockedSkins).toHaveLength(2);
  });

  it("GameSettings defaults are sensible", () => {
    const s: GameSettings = {
      masterVolume: 0.8,
      musicEnabled: true,
      slingshotSensitivity: 1,
      haptics: true,
    };
    expect(s.masterVolume).toBeGreaterThan(0);
    expect(s.masterVolume).toBeLessThanOrEqual(1);
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
      position: [2, 5, 0],
      width: 3,
      depth: 2,
      type: "booster",
    };
    expect(t.type).toBe("booster");
  });
});
