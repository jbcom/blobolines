import { expect, test } from "vitest";
import { nextClimbGoal } from "../gameOverGoal";

const baseStats = {
  bestHeight: 80,
  bestScore: 1200,
  lifetimeCrystals: 40,
  runHeight: 80,
  runMaxCombo: 1,
  runCrystals: 3,
  dailyStreak: 0,
};

test("nextClimbGoal picks the nearest incomplete achievement target", () => {
  const goal = nextClimbGoal({
    stats: baseStats,
    unlockedAchievements: [],
    dailyRun: false,
  });

  expect(goal).toMatchObject({
    title: "Cloud Niner",
    progressText: "80 / 100 m",
    progressPct: 80,
  });
  expect(goal.ariaLabel).toContain("Next climb goal: Cloud Niner");
});

test("nextClimbGoal skips already-met targets and chooses the best partial", () => {
  const goal = nextClimbGoal({
    stats: {
      ...baseStats,
      bestHeight: 160,
      runMaxCombo: 4,
    },
    unlockedAchievements: ["height-100"],
    dailyRun: false,
  });

  expect(goal).toMatchObject({
    title: "On a Roll",
    progressText: "4 / 5 clean combo",
    progressPct: 80,
  });
});

test("nextClimbGoal keeps daily-streak goals on daily results", () => {
  const goal = nextClimbGoal({
    stats: {
      ...baseStats,
      bestHeight: 2500,
      bestScore: 30_000,
      lifetimeCrystals: 800,
      runMaxCombo: 12,
      runCrystals: 25,
      dailyStreak: 2,
    },
    unlockedAchievements: [
      "height-100",
      "height-250",
      "height-500",
      "height-1000",
      "height-2000",
      "combo-5",
      "combo-8",
      "combo-12",
      "crystals-run-25",
      "crystals-total-250",
      "crystals-total-500",
      "score-10k",
      "score-25k",
    ],
    dailyRun: true,
  });

  expect(goal).toMatchObject({
    title: "Daily Devotee",
    progressText: "2 / 3 day streak",
    progressPct: 66,
  });
});

test("nextClimbGoal floors progress so a locked target never renders full", () => {
  const goal = nextClimbGoal({
    stats: {
      ...baseStats,
      bestHeight: 249,
    },
    unlockedAchievements: ["height-100"],
    dailyRun: false,
  });

  expect(goal).toMatchObject({
    title: "Stratosphere",
    progressText: "249 / 250 m",
    progressPct: 99,
  });
});
