import { beforeEach, describe, expect, it } from "vitest";
import { dailyKey, dailySeedPhrase } from "@/sim/daily";
import { playerProgressSchema } from "../persistence";
import {
  DEFAULT_PROGRESS,
  DEFAULT_SETTINGS,
  equippedSkinColor,
  SKIN_COST,
  useGameStore,
} from "../store";
import { useWorldStore } from "../worldStore";

beforeEach(() => {
  useGameStore.setState({
    phase: "menu",
    settings: { ...DEFAULT_SETTINGS },
    progress: { ...DEFAULT_PROGRESS },
    run: {
      height: 0,
      crystals: 0,
      combo: 0,
      maxCombo: 0,
      recordDelta: 0,
      score: 0,
      stylePoints: 0,
      scoreDelta: 0,
      unlockedAchievements: [],
    },
  });
});

describe("useGameStore", () => {
  it("starts in menu phase", () => {
    expect(useGameStore.getState().phase).toBe("menu");
  });

  it("setPhase transitions phase", () => {
    useGameStore.getState().setPhase("playing");
    expect(useGameStore.getState().phase).toBe("playing");
  });

  it("togglePause flips playing↔paused and is a no-op on menu/gameover", () => {
    const { setPhase, togglePause } = useGameStore.getState();
    setPhase("playing");
    togglePause();
    expect(useGameStore.getState().phase).toBe("paused"); // playing → paused
    togglePause();
    expect(useGameStore.getState().phase).toBe("playing"); // paused → playing
    // Not pausable from the menu or after game over.
    setPhase("menu");
    togglePause();
    expect(useGameStore.getState().phase).toBe("menu");
    setPhase("gameover");
    togglePause();
    expect(useGameStore.getState().phase).toBe("gameover");
  });

  it("updateSettings patches only provided keys", () => {
    useGameStore.getState().updateSettings({ masterVolume: 0.5 });
    const { settings } = useGameStore.getState();
    expect(settings.masterVolume).toBe(0.5);
    expect(settings.musicEnabled).toBe(DEFAULT_SETTINGS.musicEnabled);
  });

  it("addCrystals adds to both run and progress", () => {
    useGameStore.getState().addCrystals(10);
    const s = useGameStore.getState();
    expect(s.run.crystals).toBe(10);
    expect(s.progress.crystals).toBe(10);
  });

  it("resetRun clears run crystals without touching progress", () => {
    useGameStore.getState().addCrystals(5);
    useGameStore.getState().resetRun();
    const s = useGameStore.getState();
    expect(s.run.crystals).toBe(0);
    expect(s.progress.crystals).toBe(5);
  });

  it("grants the tied skin when its achievement is newly unlocked (height-1000 → ink)", () => {
    expect(useGameStore.getState().progress.unlockedSkins).not.toContain("ink");
    useGameStore.getState().setRun({ height: 1000 }); // meets height-1000 (bestHeight ≥ 1000)
    const p = useGameStore.getState().progress;
    expect(p.unlockedAchievements).toContain("height-1000");
    expect(p.unlockedSkins, "ink is earned by the deep-space achievement").toContain("ink");
  });

  it("does not grant achievement-gated skins for an unrelated unlock", () => {
    useGameStore.getState().setRun({ height: 100 }); // height-100, not tied to any skin
    const p = useGameStore.getState().progress;
    expect(p.unlockedAchievements).toContain("height-100");
    expect(p.unlockedSkins).toEqual(["blue"]); // no cosmetic granted
  });

  it("dailyRun flag toggles (default false) for the daily-challenge framing", () => {
    expect(useGameStore.getState().dailyRun).toBe(false);
    useGameStore.getState().setDailyRun(true);
    expect(useGameStore.getState().dailyRun).toBe(true);
    useGameStore.getState().setDailyRun(false);
    expect(useGameStore.getState().dailyRun).toBe(false);
  });

  it("commitBestHeight advances the daily streak ONLY on TODAY'S daily run", () => {
    // A non-daily run must not touch the streak.
    useGameStore.getState().setDailyRun(false);
    useGameStore.getState().commitBestHeight(200);
    expect(useGameStore.getState().progress.dailyStreak ?? 0).toBe(0);
    expect(useGameStore.getState().progress.lastDailyKey).toBeUndefined();

    // A daily run on TODAY'S daily tower starts the streak at 1 and stamps today's key. The streak
    // gate requires the run's seed to be today's daily seed, not merely the dailyRun flag — so set
    // the world seed accordingly. (Day-to-day progression is covered by the nextDailyStreak units.)
    useGameStore.getState().setDailyRun(true);
    useWorldStore.setState({ seedPhrase: dailySeedPhrase(new Date()) });
    useGameStore.getState().commitBestHeight(300);
    const p = useGameStore.getState().progress;
    expect(p.dailyStreak).toBe(1);
    expect(p.lastDailyKey).toBe(dailyKey(new Date()));

    // Replaying the SAME day's daily must NOT inflate the streak (still 1).
    useGameStore.getState().commitBestHeight(350);
    expect(useGameStore.getState().progress.dailyStreak).toBe(1);
  });

  it("replaying a PAST day's daily does NOT advance the streak (it's not today's challenge)", () => {
    // Establish a streak by playing today's daily.
    useGameStore.getState().setDailyRun(true);
    useWorldStore.setState({ seedPhrase: dailySeedPhrase(new Date()) });
    useGameStore.getState().commitBestHeight(300);
    expect(useGameStore.getState().progress.dailyStreak).toBe(1);
    const anchor = useGameStore.getState().progress.lastDailyKey;

    // Now replay an OLD daily tower (a past-date daily seed) — still a dailyRun, but NOT today's
    // shared challenge. The streak + anchor must be untouched.
    useWorldStore.setState({ seedPhrase: "blobolines-daily-2000-01-01" });
    useGameStore.getState().commitBestHeight(400);
    expect(useGameStore.getState().progress.dailyStreak).toBe(1);
    expect(useGameStore.getState().progress.lastDailyKey).toBe(anchor);
  });

  it("records today's daily best into dailyBests (and keeps the higher of two runs)", () => {
    const today = dailyKey(new Date());
    useGameStore.getState().setDailyRun(true);
    useWorldStore.setState({ seedPhrase: dailySeedPhrase(new Date()) });
    useGameStore.getState().commitBestHeight(300);
    const first = useGameStore.getState().progress.dailyBests?.[today];
    expect(first, "today's daily best is recorded").toBeGreaterThan(0);
    // A higher second run on today's daily raises the day's best; a lower one leaves it.
    useGameStore.getState().commitBestHeight(900);
    const better = useGameStore.getState().progress.dailyBests?.[today] ?? 0;
    expect(better).toBeGreaterThan(first ?? 0);
    useGameStore.getState().commitBestHeight(50);
    expect(useGameStore.getState().progress.dailyBests?.[today]).toBe(better);
    // A NON-daily run doesn't touch dailyBests.
    useGameStore.getState().setDailyRun(false);
    useGameStore.getState().commitBestHeight(5000);
    expect(useGameStore.getState().progress.dailyBests?.[today]).toBe(better);
  });

  it("replaySeed regenerates the tower, starts playing, and flags daily iff a daily seed", () => {
    // A normal seed replays as a non-daily run.
    useGameStore.getState().setDailyRun(true); // stale flag from a prior run
    useGameStore.getState().replaySeed("bouncy-bright-blob", "ready");
    expect(useGameStore.getState().phase).toBe("playing");
    expect(useGameStore.getState().dailyRun).toBe(false);
    expect(useWorldStore.getState().seedPhrase).toBe("bouncy-bright-blob");

    // A daily seed replays as a DAILY run (so the game-over daily framing shows).
    useGameStore.getState().replaySeed("blobolines-daily-2026-06-20", "hard");
    expect(useGameStore.getState().dailyRun).toBe(true);
    expect(useWorldStore.getState().seedPhrase).toBe("blobolines-daily-2026-06-20");
    expect(useWorldStore.getState().difficulty).toBe("hard");
  });

  it("never moves the streak anchor BACKWARD (backward-clock exploit guard)", () => {
    // Simulate a stored future anchor (a player who set the clock forward, played, then set it back):
    // lastDailyKey is in the year 3000, so today's key is lexicographically smaller. A daily commit
    // must NOT overwrite the anchor with the older key (which would let them inflate the streak on
    // clock-restore), and must NOT advance the streak.
    useGameStore.setState((s) => ({
      progress: { ...s.progress, dailyStreak: 9, lastDailyKey: "3000-01-01" },
    }));
    useGameStore.getState().setDailyRun(true);
    useGameStore.getState().commitBestHeight(400);
    const p = useGameStore.getState().progress;
    expect(p.lastDailyKey).toBe("3000-01-01"); // anchor unchanged — never moved backward
    expect(p.dailyStreak).toBe(9); // streak unchanged — not inflated
  });

  it("crossing a 7-day daily streak unlocks Faithful AND grants the aurora skin", () => {
    // Seed a 6-day streak whose last completed daily was YESTERDAY, then commit TODAY'S daily run.
    // The streak extends to 7, which crosses both daily-streak achievements; the 7-day one is tied
    // to the aurora skin (SKIN_ACHIEVEMENT), so the same commit must grant aurora.
    const today = new Date();
    const yesterday = dailyKey(
      new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 1)),
    );
    useGameStore.setState((s) => ({
      progress: { ...s.progress, dailyStreak: 6, lastDailyKey: yesterday },
    }));
    useGameStore.getState().setDailyRun(true);
    useWorldStore.setState({ seedPhrase: dailySeedPhrase(today) });
    useGameStore.getState().commitBestHeight(500);

    const p = useGameStore.getState().progress;
    expect(p.dailyStreak).toBe(7); // extended yesterday → today
    expect(p.unlockedAchievements).toContain("daily-streak-3");
    expect(p.unlockedAchievements).toContain("daily-streak-7");
    expect(p.unlockedSkins).toContain("aurora"); // milestone cosmetic granted in the same pass
  });

  it("unlockAchievements persists newly-met ids once and returns only the fresh ones", () => {
    // A 100m best unlocks "height-100"; the action returns it and stores it.
    const fresh = useGameStore.getState().unlockAchievements({
      bestHeight: 100,
      bestScore: 0,
      lifetimeCrystals: 0,
      runHeight: 100,
      runMaxCombo: 0,
      runCrystals: 0,
      dailyStreak: 0,
    });
    expect(fresh).toContain("height-100");
    expect(useGameStore.getState().progress.unlockedAchievements).toContain("height-100");
    // Re-evaluating the same stats reports NOTHING new (already unlocked) + no duplicate stored.
    const again = useGameStore.getState().unlockAchievements({
      bestHeight: 100,
      bestScore: 0,
      lifetimeCrystals: 0,
      runHeight: 100,
      runMaxCombo: 0,
      runCrystals: 0,
      dailyStreak: 0,
    });
    expect(again).toEqual([]);
    const ids = useGameStore.getState().progress.unlockedAchievements;
    expect(ids.filter((id) => id === "height-100")).toHaveLength(1);
  });

  it("unlockAchievements ALSO grants a tied cosmetic skin (the second grant path)", () => {
    expect(useGameStore.getState().progress.unlockedSkins).not.toContain("ink");
    const fresh = useGameStore.getState().unlockAchievements({
      bestHeight: 1000, // meets height-1000 → grants ink
      bestScore: 0,
      lifetimeCrystals: 0,
      runHeight: 1000,
      runMaxCombo: 0,
      runCrystals: 0,
      dailyStreak: 0,
    });
    expect(fresh).toContain("height-1000");
    expect(useGameStore.getState().progress.unlockedSkins).toContain("ink");
  });

  it("real-time checkAndUnlock triggers on setRun height change and addCrystals", () => {
    // 1. Trigger height-100 real-time via setRun height mutation
    useGameStore.getState().setRun({ height: 105 });
    let s = useGameStore.getState();
    expect(s.run.unlockedAchievements).toContain("height-100");
    expect(s.progress.unlockedAchievements).toContain("height-100");

    // 2. Trigger combo-5 real-time via setRun combo mutation
    useGameStore.getState().setRun({ maxCombo: 6 });
    s = useGameStore.getState();
    expect(s.run.unlockedAchievements).toContain("combo-5");
    expect(s.progress.unlockedAchievements).toContain("combo-5");

    // 3. Trigger crystals achievement real-time via addCrystals mutation
    useGameStore.getState().addCrystals(30);
    s = useGameStore.getState();
    expect(s.run.unlockedAchievements).toContain("crystals-run-25");
    expect(s.progress.unlockedAchievements).toContain("crystals-run-25");
  });

  it("commitBestHeight only updates when new height is higher", () => {
    useGameStore.getState().commitBestHeight(100);
    expect(useGameStore.getState().progress.bestHeight).toBe(100);
    useGameStore.getState().commitBestHeight(50);
    expect(useGameStore.getState().progress.bestHeight).toBe(100);
  });

  it("commitBestHeight floors to int", () => {
    useGameStore.getState().commitBestHeight(123.9);
    expect(useGameStore.getState().progress.bestHeight).toBe(123);
  });

  it("commitBestHeight computes + records a composite score (height + crystals + combo)", () => {
    const s = useGameStore.getState();
    s.addCrystals(4);
    s.setRun({ maxCombo: 5 });
    s.commitBestHeight(120);
    const after = useGameStore.getState();
    expect(after.run.score).toBeGreaterThan(120); // more than height alone (crystals + combo)
    expect(after.progress.bestScore).toBe(after.run.score);
    expect(after.run.scoreDelta).toBe(after.run.score); // first run: whole score is the delta
  });

  it("a higher SCORE sets a record even when height is LOWER (separate records)", () => {
    const s = useGameStore.getState();
    // First run: tall, no crystals/combo.
    s.commitBestHeight(200);
    const firstScore = useGameStore.getState().progress.bestScore;
    // Second run: shorter height but loaded with crystals → can beat the score.
    s.resetRun();
    s.addCrystals(20);
    s.setRun({ maxCombo: 8 });
    s.commitBestHeight(150);
    const after = useGameStore.getState();
    expect(after.progress.bestHeight).toBe(200); // height best unchanged (150 < 200)
    expect(after.run.recordDelta).toBe(0); // not a height record
    expect(after.run.score).toBeGreaterThan(firstScore); // but a score record
    expect(after.run.scoreDelta).toBeGreaterThan(0);
    expect(after.progress.bestScore).toBe(after.run.score);
  });

  it("resetProgress wipes best height, crystals, unlocks and skin to defaults", () => {
    const s = useGameStore.getState();
    s.commitBestHeight(200);
    s.addCrystals(50);
    s.unlockSkin("slime");
    s.setSkin("slime");
    s.resetProgress();
    const p = useGameStore.getState().progress;
    expect(p.bestHeight).toBe(0);
    expect(p.crystals).toBe(0);
    expect(p.unlockedSkins).toEqual(["blue"]);
    expect(p.skin).toBe("blue");
  });

  it("setSkin changes equipped skin", () => {
    useGameStore.getState().setSkin("slime");
    expect(useGameStore.getState().progress.skin).toBe("slime");
  });

  it("unlockSkin adds skin without duplicates", () => {
    useGameStore.getState().unlockSkin("ghost");
    useGameStore.getState().unlockSkin("ghost");
    const skins = useGameStore.getState().progress.unlockedSkins;
    expect(skins.filter((s) => s === "ghost").length).toBe(1);
  });

  it("SKIN_COST keeps the warm Mango base free and excludes achievement-gated skins", () => {
    expect(SKIN_COST.blue).toBe(0);
    expect(SKIN_COST.slime).toBe(15);
    // ghost + ink are EARNED via achievements, never crystal-buyable — no cost entry exists, so a
    // future SKIN_COST reader can't accidentally treat them as purchasable.
    expect(SKIN_COST.ghost).toBeUndefined();
    expect(SKIN_COST.ink).toBeUndefined();
  });

  it("equippedSkinColor returns token hex", () => {
    const color = equippedSkinColor(useGameStore.getState());
    expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  describe("Leaderboard (High Scores)", () => {
    it("initializes with an empty highScores list", () => {
      expect(useGameStore.getState().progress.highScores).toEqual([]);
    });

    it("appends new runs on commitBestHeight and sorts descending by composite score", () => {
      const s = useGameStore.getState();

      // Simulate run 1: low score
      s.resetRun();
      s.commitBestHeight(100);

      // Simulate run 2: higher score
      s.resetRun();
      s.commitBestHeight(250);

      // Simulate run 3: shorter but high combo & crystals -> higher score
      s.resetRun();
      s.addCrystals(50);
      s.setRun({ maxCombo: 10 });
      s.commitBestHeight(80);

      const scores = useGameStore.getState().progress.highScores ?? [];
      expect(scores.length).toBe(3);

      // Check that they are sorted descending by score
      expect(scores[0].score).toBeGreaterThanOrEqual(scores[1].score);
      expect(scores[1].score).toBeGreaterThanOrEqual(scores[2].score);
    });

    it("truncates the leaderboard to exactly the top 5 runs of all time", () => {
      const s = useGameStore.getState();

      // Record 7 runs with increasing heights (hence increasing scores)
      for (let i = 1; i <= 7; i++) {
        s.resetRun();
        s.commitBestHeight(i * 50);
      }

      const scores = useGameStore.getState().progress.highScores ?? [];
      expect(scores).toHaveLength(5);

      // Top score should be from the 7th run (350m)
      expect(scores[0].height).toBe(350);
      // Lowest of the top 5 should be from the 3rd run (150m), meaning 1st (50) and 2nd (100) were dropped
      expect(scores[4].height).toBe(150);
    });

    it("successfully falls back to empty array when highScores is absent from parsed progress", () => {
      const legacySave = {
        bestHeight: 120,
        bestScore: 1200,
        crystals: 45,
        skin: "blue",
        unlockedSkins: ["blue", "slime"],
        tutorialSeen: true,
        unlockedAchievements: ["height-100"],
      };

      const parsed = playerProgressSchema.safeParse(legacySave);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.highScores).toEqual([]);
        expect(parsed.data.bestHeight).toBe(120);
      }
    });

    it("recovers gracefully from individual corrupted high score entry keys", () => {
      const corruptSave = {
        bestHeight: 100,
        highScores: [
          {
            score: "this-is-not-a-number", // corrupted
            height: 100,
            crystals: 5,
            maxCombo: 2,
            date: "2026-06-18",
            seedPhrase: "some-seed",
            difficulty: "ready",
          },
        ],
      };

      const parsed = playerProgressSchema.safeParse(corruptSave);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.highScores).toHaveLength(1);
        expect(parsed.data.highScores?.[0].score).toBe(0); // catches corrupt score and falls back to 0
      }
    });

    it("round-trips the daily streak + per-day bests (so the weekly summary survives a reload)", () => {
      const save = {
        bestHeight: 500,
        dailyStreak: 7,
        lastDailyKey: "2026-06-20",
        dailyBests: { "2026-06-20": 1500, "2026-06-19": 900 },
      };
      const parsed = playerProgressSchema.safeParse(save);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.dailyStreak).toBe(7);
        expect(parsed.data.lastDailyKey).toBe("2026-06-20");
        expect(parsed.data.dailyBests).toEqual({ "2026-06-20": 1500, "2026-06-19": 900 });
      }
    });

    it("loads progress saved BEFORE the streak feature without error (undefined streak)", () => {
      const legacy = { bestHeight: 300, unlockedAchievements: ["height-100"] };
      const parsed = playerProgressSchema.safeParse(legacy);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.dailyStreak).toBeUndefined();
        expect(parsed.data.lastDailyKey).toBeUndefined();
      }
    });
  });
});
