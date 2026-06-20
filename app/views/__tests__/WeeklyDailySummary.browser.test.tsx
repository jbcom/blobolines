import { afterEach, beforeEach, expect, test } from "vitest";
import { cleanup, render } from "vitest-browser-react";
import { dailyKey } from "@/sim/daily";
import { useGameStore } from "@/state";
import { WeeklyDailySummary } from "../WeeklyDailySummary";

beforeEach(() => {
  useGameStore.setState((s) => ({ progress: { ...s.progress, dailyBests: {}, dailyStreak: 0 } }));
});
afterEach(() => cleanup());

test("renders nothing until at least one daily is recorded", async () => {
  const screen = await render(<WeeklyDailySummary />);
  await expect.element(screen.getByTestId("weekly-daily-summary").query()).not.toBeInTheDocument();
});

test("shows the week's daily bests, days-played count, and the best score", async () => {
  const today = dailyKey(new Date());
  useGameStore.setState((s) => ({
    progress: { ...s.progress, dailyStreak: 3, dailyBests: { [today]: 2400 } },
  }));
  const screen = await render(<WeeklyDailySummary />);
  await expect.element(screen.getByTestId("weekly-daily-summary")).toBeInTheDocument();
  await expect.element(screen.getByText("This week's dailies")).toBeInTheDocument();
  await expect.element(screen.getByText("1/7 day played")).toBeInTheDocument();
  await expect.element(screen.getByText("2,400")).toBeInTheDocument(); // the week best
  await expect.element(screen.getByText("3-day streak")).toBeInTheDocument();
  // The played day's bar carries an accessible label with its score.
  await expect.element(screen.getByLabelText(`${today}: 2,400 points`)).toBeInTheDocument();
});
