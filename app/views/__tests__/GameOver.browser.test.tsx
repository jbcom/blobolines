import { afterEach, beforeEach, expect, test } from "vitest";
import { cleanup, render } from "vitest-browser-react";
import { useGameStore } from "@/state";
import { GameOver } from "../GameOver";

beforeEach(() => {
  useGameStore.setState({
    phase: "gameover",
    run: { height: 80, crystals: 3, combo: 0, maxCombo: 5 },
    progress: { ...useGameStore.getState().progress, bestHeight: 134, crystals: 42 },
  });
});
afterEach(() => {
  cleanup();
  useGameStore.setState({ phase: "menu" });
});

test("shows the run recap: altitude, max combo, crystals run + lifetime, short-by delta", async () => {
  const screen = await render(<GameOver />);
  await expect.element(screen.getByText("80 m")).toBeInTheDocument();
  await expect.element(screen.getByText("Max combo")).toBeInTheDocument();
  // 42 lifetime crystals appears as the crystals sublabel.
  await expect.element(screen.getByText("42 lifetime")).toBeInTheDocument();
  // 134 best - 80 height = 54m short.
  await expect.element(screen.getByText("54 m short")).toBeInTheDocument();
});

test("celebrates a record run instead of a short-by delta", async () => {
  useGameStore.setState({
    run: { height: 150, crystals: 1, combo: 0, maxCombo: 2 },
    progress: { ...useGameStore.getState().progress, bestHeight: 150 },
  });
  const screen = await render(<GameOver />);
  await expect.element(screen.getByText("New best climb!")).toBeInTheDocument();
  await expect.element(screen.getByText("New record!")).toBeInTheDocument();
});
