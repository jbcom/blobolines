import { afterEach, beforeEach, expect, test } from "vitest";
import { cleanup, render } from "vitest-browser-react";
import { useGameStore } from "@/state";
import { BiomeBanner } from "../BiomeBanner";

beforeEach(() => {
  useGameStore.setState({
    phase: "playing",
    run: { ...useGameStore.getState().run, height: 0 },
  });
});

afterEach(() => {
  cleanup();
  useGameStore.setState({ phase: "menu" });
});

test("announces the new biome when the climb crosses UP into the next band", async () => {
  const screen = await render(<BiomeBanner />);
  // Starting on the ground band — nothing announced yet.
  await expect.element(screen.getByText("The Sky").query()).not.toBeInTheDocument();

  // Cross the sky band threshold (minHeight 120).
  useGameStore.setState((s) => ({ run: { ...s.run, height: 150 } }));

  await expect.element(screen.getByText("The Sky")).toBeInTheDocument();
  await expect.element(screen.getByText("Entering")).toBeInTheDocument();
});

test("does not announce the starting band as a transition", async () => {
  const screen = await render(<BiomeBanner />);
  // A small climb that stays within the ground band must not fire a banner.
  useGameStore.setState((s) => ({ run: { ...s.run, height: 40 } }));
  await expect.element(screen.getByText("The Ground").query()).not.toBeInTheDocument();
});

test("does not fire on a DESCENT back through a band boundary", async () => {
  const screen = await render(<BiomeBanner />);
  // Climb into the sky band first (this DOES announce).
  useGameStore.setState((s) => ({ run: { ...s.run, height: 150 } }));
  await expect.element(screen.getByText("The Sky")).toBeInTheDocument();

  // Falling back below the sky threshold must not re-announce "The Ground".
  useGameStore.setState((s) => ({ run: { ...s.run, height: 20 } }));
  await expect.element(screen.getByText("The Ground").query()).not.toBeInTheDocument();
});
