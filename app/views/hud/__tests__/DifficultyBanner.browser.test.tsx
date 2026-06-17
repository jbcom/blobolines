import { afterEach, beforeEach, expect, test } from "vitest";
import { cleanup, render } from "vitest-browser-react";
import { useGameStore, useWorldStore } from "@/state";
import { DifficultyBanner } from "../DifficultyBanner";

beforeEach(() => {
  useWorldStore.getState().reset("difficulty-banner", "ready");
  useGameStore.setState({
    phase: "playing",
    run: { ...useGameStore.getState().run, height: 0 },
  });
});

afterEach(() => {
  cleanup();
  useGameStore.setState({ phase: "menu" });
});

test("announces the effective difficulty when the run crosses into Medium", async () => {
  const screen = await render(<DifficultyBanner />);
  await expect.element(screen.getByText("MEDIUM!!!").query()).not.toBeInTheDocument();

  useGameStore.setState((s) => ({ run: { ...s.run, height: 540 } }));

  await expect.element(screen.getByText("MEDIUM!!!")).toBeInTheDocument();
  await expect.element(screen.getByText("difficulty up")).toBeInTheDocument();
});

test("does not announce the starting difficulty as a transition", async () => {
  const screen = await render(<DifficultyBanner />);
  useGameStore.setState((s) => ({ run: { ...s.run, height: 200 } }));
  await expect.element(screen.getByText("EASY!!!").query()).not.toBeInTheDocument();
});
