import { afterEach, expect, test } from "vitest";
import { cleanup, render } from "vitest-browser-react";
import { reportAchievementToast, resetAchievementToasts, useGameStore } from "@/state";
import { AchievementToast } from "../AchievementToast";

afterEach(() => {
  cleanup();
  resetAchievementToasts();
});

test("renders a queued achievement unlock with its title + description", async () => {
  // Haptics on — the unlock effect fires playChime + a success notify() (both no-op in the test
  // browser); the assertion is that the toast still mounts and shows the achievement cleanly.
  useGameStore.setState((s) => ({ settings: { ...s.settings, haptics: true } }));
  const screen = await render(<AchievementToast />);
  reportAchievementToast("height-100"); // "Cloud Niner — Reach 100 m in a single run."
  await expect.element(screen.getByText("Achievement Unlocked!")).toBeInTheDocument();
  await expect.element(screen.getByText("Cloud Niner")).toBeInTheDocument();
  await expect.element(screen.getByText(/Reach 100 m/)).toBeInTheDocument();
});

test("renders nothing when no achievement is queued", async () => {
  const screen = await render(<AchievementToast />);
  await expect.element(screen.getByText("Achievement Unlocked!").query()).not.toBeInTheDocument();
});

test("the unlock effect path runs cleanly with haptics DISABLED (no notify, still toasts)", async () => {
  // The haptic is settings-gated; with haptics off the toast must still show — the gate must never
  // swallow the visual unlock.
  useGameStore.setState((s) => ({ settings: { ...s.settings, haptics: false } }));
  const screen = await render(<AchievementToast />);
  reportAchievementToast("combo-5"); // "On a Roll — Chain a 5× clean-bounce combo."
  await expect.element(screen.getByText("On a Roll")).toBeInTheDocument();
});
