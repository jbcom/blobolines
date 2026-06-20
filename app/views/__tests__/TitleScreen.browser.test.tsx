import { afterEach, expect, test } from "vitest";
import { cleanup, render } from "vitest-browser-react";
import { dailyKey } from "@/sim/daily";
import { useGameStore, useWorldStore } from "@/state";
import { TitleScreen } from "../TitleScreen";

afterEach(() => {
  cleanup();
  useGameStore.setState({ phase: "menu", dailyRun: false });
  useGameStore.setState((s) => ({
    progress: { ...s.progress, dailyStreak: undefined, lastDailyKey: undefined },
  }));
  useWorldStore.getState().reset(1, "ready");
});

/** UTC YYYY-MM-DD `back` days before today — for seeding a streak's last-played key relative to now. */
function keyDaysAgo(back: number): string {
  const t = new Date();
  return dailyKey(new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate() - back)));
}

test("renders the Play CTA and the Daily Challenge entry", async () => {
  const screen = await render(<TitleScreen />);
  await expect.element(screen.getByRole("button", { name: /^Play/ })).toBeInTheDocument();
  await expect.element(screen.getByRole("button", { name: /Daily Challenge/ })).toBeInTheDocument();
});

test("Daily Challenge starts a daily run (dailyRun true)", async () => {
  useGameStore.setState({ dailyRun: false });
  const screen = await render(<TitleScreen />);
  await screen.getByRole("button", { name: /Daily Challenge/ }).click();
  await expect
    .element(screen.getByRole("dialog", { name: /Daily challenge difficulty/ }))
    .toBeInTheDocument();
  expect((document.getElementById("new-game-seed") as HTMLInputElement).value).toMatch(
    /^blobolines-daily-/,
  );
  await screen.getByRole("button", { name: /Medium/ }).click();
  expect(useGameStore.getState().phase).toBe("playing");
  expect(useGameStore.getState().dailyRun).toBe(true);
  expect(useWorldStore.getState().difficulty).toBe("medium");
  expect(useWorldStore.getState().seedPhrase).toMatch(/^blobolines-daily-/);
});

test("Play starts a normal run (dailyRun false even if a daily flag lingered)", async () => {
  useGameStore.setState({ dailyRun: true }); // a stale daily flag from a prior run
  const screen = await render(<TitleScreen />);
  await screen.getByRole("button", { name: /^Play/ }).click();
  await expect
    .element(screen.getByRole("dialog", { name: /New game difficulty/ }))
    .toBeInTheDocument();
  await expect.element(screen.getByRole("button", { name: /Shuffle seed/ })).toBeInTheDocument();
  await screen.getByRole("button", { name: /Easy/ }).click();
  expect(useGameStore.getState().phase).toBe("playing");
  expect(useGameStore.getState().dailyRun).toBe(false); // normal Play clears it
  expect(useWorldStore.getState().difficulty).toBe("ready");
  expect(useWorldStore.getState().seedPhrase).toMatch(/^[a-z]+-[a-z]+-[a-z]+$/);
});

test("an AT-RISK daily streak nudges 'play today to keep it' on the Daily Challenge CTA", async () => {
  // Streak alive (last played YESTERDAY) but today not yet done → the at-risk nudge shows.
  useGameStore.setState((s) => ({
    progress: { ...s.progress, dailyStreak: 4, lastDailyKey: keyDaysAgo(1) },
  }));
  const screen = await render(<TitleScreen />);
  await expect.element(screen.getByText(/Play today to keep your streak/)).toBeInTheDocument();
  // The button's accessible name carries the streak + keep-it prompt.
  await expect
    .element(screen.getByRole("button", { name: /4-day streak, play today to keep it/ }))
    .toBeInTheDocument();
});

test("a SECURED daily streak (played today) shows the count without the at-risk nudge", async () => {
  useGameStore.setState((s) => ({
    progress: { ...s.progress, dailyStreak: 4, lastDailyKey: dailyKey(new Date()) },
  }));
  const screen = await render(<TitleScreen />);
  await expect
    .element(screen.getByRole("button", { name: /4-day streak, secured today/ }))
    .toBeInTheDocument();
  expect(screen.container.textContent).not.toContain("Play today to keep your streak");
});

test("no streak → plain Daily Challenge CTA, no flame badge", async () => {
  const screen = await render(<TitleScreen />);
  const btn = screen.getByRole("button", { name: /Daily Challenge/ });
  await expect.element(btn).toBeInTheDocument();
  expect(screen.container.textContent).not.toContain("🔥");
});

test("opening Settings lazy-loads + shows the modal through the Suspense boundary", async () => {
  const screen = await render(<TitleScreen />);
  await screen.getByRole("button", { name: /Settings/ }).click();
  // The modal's lazy chunk resolves and its heading appears (it isn't mounted until opened).
  await expect.element(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument();
});
