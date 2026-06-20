import { afterEach, beforeEach, expect, test } from "vitest";
import { cleanup, render } from "vitest-browser-react";
import { useGameStore } from "@/state";
import { AchievementsModal } from "../AchievementsModal";

beforeEach(() => {
  // A mid-progress player: 640m best (toward the 1000m "Deep Space" medal), 5000 score (toward the
  // 10k "High Roller"), no achievements unlocked yet.
  useGameStore.setState((s) => ({
    progress: {
      ...s.progress,
      bestHeight: 640,
      bestScore: 5000,
      crystals: 0,
      unlockedAchievements: [],
    },
  }));
});
afterEach(() => cleanup());

const noop = () => {};

test("a locked achievement shows a progress bar toward its target", async () => {
  const screen = await render(<AchievementsModal open onOpenChange={noop} />);
  await expect.element(screen.getByTestId("achievements-modal")).toBeInTheDocument();
  // height-1000 is locked; the player is at 640m → the "640 / 1,000" progress label shows.
  await expect.element(screen.getByText("640 / 1,000")).toBeInTheDocument();
  // score-10k locked at 5000 → "5,000 / 10,000".
  await expect.element(screen.getByText("5,000 / 10,000")).toBeInTheDocument();
});

test("an achievement with NO progress shows no stalled bar (run-only medal at rest)", async () => {
  const screen = await render(<AchievementsModal open onOpenChange={noop} />);
  await expect.element(screen.getByTestId("achievements-modal")).toBeInTheDocument();
  // combo-5 is a run-only medal; from the menu the run combo is 0 → no "0 / 5" bar is rendered
  // (it would read as a stalled/empty bar). The fraction<=0 guard suppresses it. Exact match so the
  // substring "0 / 5" inside another label (e.g. "640 / 500") can't false-match.
  await expect.element(screen.getByText("0 / 5", { exact: true }).query()).not.toBeInTheDocument();
  await expect.element(screen.getByText("0 / 25", { exact: true }).query()).not.toBeInTheDocument();
});

test("an UNLOCKED achievement shows no progress bar (it's done)", async () => {
  useGameStore.setState((s) => ({
    progress: { ...s.progress, bestHeight: 640, unlockedAchievements: ["height-100"] },
  }));
  const screen = await render(<AchievementsModal open onOpenChange={noop} />);
  // height-100 is unlocked → no "100 / 100" progress shown for it; height-1000 still in progress.
  await expect.element(screen.getByText("100 / 100").query()).not.toBeInTheDocument();
  await expect.element(screen.getByText("640 / 1,000")).toBeInTheDocument();
});

test("a Hall-of-Fame entry's Replay button re-climbs that exact tower", async () => {
  let closed = false;
  useGameStore.setState((s) => ({
    progress: {
      ...s.progress,
      highScores: [
        {
          score: 4200,
          height: 320,
          crystals: 5,
          maxCombo: 4,
          date: "2026-06-20T00:00:00.000Z",
          seedPhrase: "blobolines-daily-2026-06-19",
          difficulty: "hard",
        },
      ],
    },
  }));
  const screen = await render(<AchievementsModal open onOpenChange={() => (closed = true)} />);
  // Switch to the Leaderboard tab where high scores live.
  await screen.getByRole("tab", { name: /leaderboard/i }).click();
  // The replay button is labelled with the seed for accessibility.
  await screen.getByRole("button", { name: /replay this tower.*2026-06-19/i }).click();
  // It closes the modal and starts a daily replay of that exact tower at its stored difficulty.
  expect(closed).toBe(true);
  expect(useGameStore.getState().phase).toBe("playing");
  expect(useGameStore.getState().dailyRun).toBe(true); // the seed is a daily seed
});
