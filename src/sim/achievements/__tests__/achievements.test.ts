import { describe, expect, it } from "vitest";
import { MAX_COMBO } from "@/sim/combo";
import { blobSkinColor } from "@/styles/tokens";
import {
  ACHIEVEMENT_SKIN,
  ACHIEVEMENTS,
  type AchievementStats,
  achievementById,
  achievementProgress,
  isMet,
  newlyUnlocked,
  SKIN_ACHIEVEMENT,
} from "../achievements";

const ZERO: AchievementStats = {
  bestHeight: 0,
  bestScore: 0,
  lifetimeCrystals: 0,
  runHeight: 0,
  runMaxCombo: 0,
  runCrystals: 0,
  dailyStreak: 0,
};

describe("achievements", () => {
  it("has unique ids and non-empty titles/descriptions", () => {
    const ids = ACHIEVEMENTS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const a of ACHIEVEMENTS) {
      expect(a.title.length).toBeGreaterThan(0);
      expect(a.description.length).toBeGreaterThan(0);
    }
  });

  it("achievementById resolves a known id and returns undefined otherwise", () => {
    expect(achievementById("height-100")?.id).toBe("height-100");
    expect(achievementById("does-not-exist")).toBeUndefined();
  });

  it("unlocks nothing at zero stats", () => {
    expect(newlyUnlocked(ZERO, [])).toEqual([]);
  });

  it("unlocks the height milestones at their thresholds", () => {
    expect(newlyUnlocked({ ...ZERO, bestHeight: 100 }, [])).toContain("height-100");
    expect(newlyUnlocked({ ...ZERO, bestHeight: 99 }, [])).not.toContain("height-100");
    expect(newlyUnlocked({ ...ZERO, bestHeight: 1000 }, [])).toEqual(
      expect.arrayContaining(["height-100", "height-250", "height-500", "height-1000"]),
    );
    // height-2000 ("Voyager") is the new apex tier — only crossed at 2000m, and it grants nebula.
    expect(newlyUnlocked({ ...ZERO, bestHeight: 1999 }, [])).not.toContain("height-2000");
    expect(newlyUnlocked({ ...ZERO, bestHeight: 2000 }, [])).toContain("height-2000");
    expect(ACHIEVEMENT_SKIN["height-2000"]).toBe("nebula");
  });

  it("unlocks the crystal total milestones at their thresholds", () => {
    expect(newlyUnlocked({ ...ZERO, lifetimeCrystals: 250 }, [])).toContain("crystals-total-250");
    expect(newlyUnlocked({ ...ZERO, lifetimeCrystals: 500 }, [])).toEqual(
      expect.arrayContaining(["crystals-total-250", "crystals-total-500"]),
    );
  });

  it("unlocks the high score milestones at their thresholds", () => {
    expect(newlyUnlocked({ ...ZERO, bestScore: 10000 }, [])).toContain("score-10k");
    expect(newlyUnlocked({ ...ZERO, bestScore: 25000 }, [])).toEqual(
      expect.arrayContaining(["score-10k", "score-25k"]),
    );
  });

  it("unlocks run-scoped achievements off the run stats", () => {
    expect(newlyUnlocked({ ...ZERO, runMaxCombo: 5 }, [])).toContain("combo-5");
    expect(newlyUnlocked({ ...ZERO, runMaxCombo: 8 }, [])).toContain("combo-8");
    // combo-12 ("Comet Streak") — now reachable since MAX_COMBO was raised to 12.
    expect(newlyUnlocked({ ...ZERO, runMaxCombo: 11 }, [])).not.toContain("combo-12");
    expect(newlyUnlocked({ ...ZERO, runMaxCombo: 12 }, [])).toContain("combo-12");
    expect(newlyUnlocked({ ...ZERO, runCrystals: 25 }, [])).toContain("crystals-run-25");
  });

  it("unlocks the daily-streak achievements off the persisted streak", () => {
    expect(newlyUnlocked({ ...ZERO, dailyStreak: 2 }, [])).not.toContain("daily-streak-3");
    expect(newlyUnlocked({ ...ZERO, dailyStreak: 3 }, [])).toContain("daily-streak-3");
    // A 7-day streak crosses BOTH the 3- and 7-day thresholds in one evaluation.
    expect(newlyUnlocked({ ...ZERO, dailyStreak: 6 }, [])).not.toContain("daily-streak-7");
    const at7 = newlyUnlocked({ ...ZERO, dailyStreak: 7 }, []);
    expect(at7).toContain("daily-streak-3");
    expect(at7).toContain("daily-streak-7");
  });

  it("every combo achievement target is within reach of MAX_COMBO", () => {
    // A combo achievement above the gameplay cap could NEVER unlock (the streak clamps at MAX_COMBO).
    for (const a of ACHIEVEMENTS) {
      if (a.id.startsWith("combo-")) {
        expect(a.target, `${a.id} must be ≤ MAX_COMBO`).toBeLessThanOrEqual(MAX_COMBO);
      }
    }
  });

  it("does NOT re-report already-unlocked achievements", () => {
    const met = { ...ZERO, bestHeight: 100 };
    expect(newlyUnlocked(met, ["height-100"])).not.toContain("height-100");
  });

  it("only returns the freshly-crossed ones, leaving prior unlocks alone", () => {
    // Already have height-100; now also cross height-250 → only height-250 is fresh.
    const fresh = newlyUnlocked({ ...ZERO, bestHeight: 260 }, ["height-100"]);
    expect(fresh).toContain("height-250");
    expect(fresh).not.toContain("height-100");
  });

  it("every achievement is threshold-based (a stat accessor + a positive target)", () => {
    for (const a of ACHIEVEMENTS) {
      expect(typeof a.stat, `${a.id} stat`).toBe("function");
      expect(a.target, `${a.id} target`).toBeGreaterThan(0);
    }
  });
});

describe("isMet", () => {
  it("is true exactly when the stat reaches the target", () => {
    const h1000 = achievementById("height-1000");
    if (!h1000) throw new Error("height-1000 missing");
    expect(isMet(h1000, { ...ZERO, bestHeight: 999 })).toBe(false);
    expect(isMet(h1000, { ...ZERO, bestHeight: 1000 })).toBe(true);
    expect(isMet(h1000, { ...ZERO, bestHeight: 1500 })).toBe(true);
  });

  it("agrees with newlyUnlocked for every achievement at exactly its target", () => {
    for (const a of ACHIEVEMENTS) {
      // Build a stats snapshot that hits exactly this achievement's axis at its target.
      const s = { ...ZERO } as AchievementStats;
      // Find which axis the stat reads by probing each axis.
      for (const axis of [
        "bestHeight",
        "bestScore",
        "lifetimeCrystals",
        "runMaxCombo",
        "runCrystals",
        "dailyStreak",
      ] as const) {
        const probe = { ...ZERO, [axis]: a.target } as AchievementStats;
        if (a.stat(probe) === a.target) {
          Object.assign(s, probe);
          break;
        }
      }
      expect(isMet(a, s), `${a.id} met at target`).toBe(true);
    }
  });
});

describe("achievementProgress", () => {
  it("reports current/target/fraction toward a locked goal", () => {
    const h1000 = achievementById("height-1000");
    if (!h1000) throw new Error("height-1000 missing");
    const p = achievementProgress(h1000, { ...ZERO, bestHeight: 640 });
    expect(p.current).toBe(640);
    expect(p.target).toBe(1000);
    expect(p.fraction).toBeCloseTo(0.64, 5);
  });

  it("clamps the fraction to [0,1] (0 at zero, 1 at/over the target)", () => {
    const score10k = achievementById("score-10k");
    if (!score10k) throw new Error("score-10k missing");
    expect(achievementProgress(score10k, ZERO).fraction).toBe(0);
    expect(achievementProgress(score10k, { ...ZERO, bestScore: 5000 }).fraction).toBeCloseTo(
      0.5,
      5,
    );
    expect(achievementProgress(score10k, { ...ZERO, bestScore: 10000 }).fraction).toBe(1);
    expect(achievementProgress(score10k, { ...ZERO, bestScore: 99999 }).fraction).toBe(1);
  });
});

describe("achievement-gated skins", () => {
  it("maps each gated skin to a REAL achievement id", () => {
    for (const [skin, achievementId] of Object.entries(SKIN_ACHIEVEMENT)) {
      expect(achievementById(achievementId), `${skin} gates on a real achievement`).toBeDefined();
    }
  });

  it("ACHIEVEMENT_SKIN is the exact inverse of SKIN_ACHIEVEMENT", () => {
    for (const [skin, achievementId] of Object.entries(SKIN_ACHIEVEMENT)) {
      expect(ACHIEVEMENT_SKIN[achievementId]).toBe(skin);
    }
    expect(Object.keys(ACHIEVEMENT_SKIN)).toHaveLength(Object.keys(SKIN_ACHIEVEMENT).length);
  });

  it("each gated achievement appears at most once (no two skins share one achievement)", () => {
    const achievementIds = Object.values(SKIN_ACHIEVEMENT);
    expect(new Set(achievementIds).size).toBe(achievementIds.length);
  });

  it("gates only valid blob skin ids", () => {
    // Derive the valid set from the skin-color source of truth so adding a skin never silently
    // staleness-breaks this guard (it just has to be a real BlobSkin).
    const VALID_SKINS = Object.keys(blobSkinColor);
    for (const skin of Object.keys(SKIN_ACHIEVEMENT)) {
      expect(VALID_SKINS, `${skin} is a real blob skin`).toContain(skin);
    }
  });
});
