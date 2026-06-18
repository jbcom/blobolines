import { afterEach, beforeEach, expect, test } from "vitest";
import { cleanup, render } from "vitest-browser-react";
import { setAim, useGameStore } from "@/state";

import { Onboarding } from "../Onboarding";

beforeEach(() => {
  setAim(null);
  useGameStore.setState({
    phase: "playing",
    progress: { ...useGameStore.getState().progress, tutorialSeen: false },
  });
});
afterEach(() => {
  cleanup();
  setAim(null);
  useGameStore.setState({ phase: "menu" });
});

test("shows the drag coachmark on a first run", async () => {
  const screen = await render(<Onboarding />);
  await expect.element(screen.getByText(/Hold .* to fling/i)).toBeInTheDocument();
});

test("stays hidden once the tutorial has been seen", async () => {
  useGameStore.setState((s) => ({ progress: { ...s.progress, tutorialSeen: true } }));
  const screen = await render(<Onboarding />);
  await expect.element(screen.getByText(/Hold .* to fling/i).query()).not.toBeInTheDocument();
});

test("dismisses + persists once the player starts aiming", async () => {
  const screen = await render(<Onboarding />);
  await expect.element(screen.getByText(/Hold .* to fling/i)).toBeInTheDocument();
  // Simulate the first hold-charge.
  setAim({ dir: [0, 1, 0], charge: 0.5 });
  await expect.element(screen.getByText(/Hold .* to fling/i).query()).not.toBeInTheDocument();
  expect(useGameStore.getState().progress.tutorialSeen).toBe(true);
});
