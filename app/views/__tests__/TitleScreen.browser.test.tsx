import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render } from "vitest-browser-react";
import { dailyKey } from "@/sim/daily";
import { useGameStore, useWorldStore } from "@/state";
import { TitleScreen } from "../TitleScreen";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  useGameStore.setState({ phase: "menu", dailyRun: false });
  useGameStore.setState((s) => ({
    progress: { ...s.progress, dailyStreak: undefined, lastDailyKey: undefined },
  }));
  useWorldStore.getState().reset(1, "ready");
});

/** A fixed mid-day-UTC instant so the streak tests are immune to a real UTC-midnight rollover
 *  between the test's `lastDailyKey` seed and the component's own `new Date()` read. Only Date is
 *  faked (toFake: ["Date"]) so the menu's 60s setInterval heartbeat keeps real timing. */
const FIXED_NOW = new Date(Date.UTC(2026, 5, 20, 12, 0, 0)); // 2026-06-20T12:00Z
const FIXED_TODAY = dailyKey(FIXED_NOW); // "2026-06-20"
function pinClock() {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(FIXED_NOW);
}

/** UTC YYYY-MM-DD `back` days before the pinned today — seeds a streak's last-played key. */
function keyDaysAgo(back: number): string {
  return dailyKey(new Date(Date.UTC(2026, 5, 20 - back)));
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
  pinClock();
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
  pinClock();
  useGameStore.setState((s) => ({
    progress: { ...s.progress, dailyStreak: 4, lastDailyKey: FIXED_TODAY },
  }));
  const screen = await render(<TitleScreen />);
  await expect
    .element(screen.getByRole("button", { name: /4-day streak, secured today/ }))
    .toBeInTheDocument();
  expect(screen.container.textContent).not.toContain("Play today to keep your streak");
});

test("the streak badge refreshes across a UTC-midnight rollover (no stale at-risk)", async () => {
  // At-risk on the pinned day (last played the prior day). After the clock advances two days past
  // the last-played key and the menu's heartbeat fires, the streak is expired → the badge vanishes.
  vi.useFakeTimers(); // fake ALL timers here so we can advance the 60s heartbeat deterministically
  vi.setSystemTime(FIXED_NOW);
  useGameStore.setState((s) => ({
    progress: { ...s.progress, dailyStreak: 4, lastDailyKey: keyDaysAgo(1) },
  }));
  const screen = await render(<TitleScreen />);
  await expect.element(screen.getByText(/Play today to keep your streak/)).toBeInTheDocument();

  // Jump the clock two whole days forward (well past the at-risk deadline) and tick the heartbeat.
  vi.setSystemTime(new Date(Date.UTC(2026, 5, 22, 12, 0, 0)));
  vi.advanceTimersByTime(60_000);
  // The recompute makes today's key gap ≥ 2 from the last-played day → expired → no badge/nudge.
  // The testing-library element query retries (on real microtasks) until the re-render settles.
  await expect.element(screen.getByText(/Play today to keep your streak/)).not.toBeInTheDocument();
  expect(screen.container.textContent).not.toContain("🔥");
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
