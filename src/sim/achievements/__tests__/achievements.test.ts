import { describe, expect, it } from "vitest";
import {
  ACHIEVEMENTS,
  type AchievementStats,
  achievementById,
  newlyUnlocked,
} from "../achievements";

const ZERO: AchievementStats = {
  bestHeight: 0,
  bestScore: 0,
  lifetimeCrystals: 0,
  runHeight: 0,
  runMaxCombo: 0,
  runCrystals: 0,
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
    expect(newlyUnlocked({ ...ZERO, bestHeight: 500 }, [])).toEqual(
      expect.arrayContaining(["height-100", "height-250", "height-500"]),
    );
  });

  it("unlocks run-scoped achievements off the run stats", () => {
    expect(newlyUnlocked({ ...ZERO, runMaxCombo: 5 }, [])).toContain("combo-5");
    expect(newlyUnlocked({ ...ZERO, runMaxCombo: 8 }, [])).toContain("combo-8");
    expect(newlyUnlocked({ ...ZERO, runCrystals: 25 }, [])).toContain("crystals-run-25");
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
});
