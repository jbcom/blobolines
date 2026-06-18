import { afterEach, beforeEach, expect, test } from "vitest";
import { cleanup, render } from "vitest-browser-react";
import { useGameStore, useWorldStore } from "@/state";
import { DifficultyMeter } from "../DifficultyMeter";

beforeEach(() => {
  useWorldStore.getState().reset("difficulty-meter", "ready");
  useGameStore.setState({
    phase: "playing",
    run: { ...useGameStore.getState().run, height: 260 },
  });
});

afterEach(() => {
  cleanup();
  useGameStore.setState({ phase: "menu" });
});

test("shows the active tier and distance to the next transition", async () => {
  const screen = await render(<DifficultyMeter />);

  await expect.element(screen.getByText("Easy")).toBeInTheDocument();
  await expect.element(screen.getByText("260m to Medium")).toBeInTheDocument();
  expect(
    screen.getByRole("img", { name: /Current difficulty Easy, 260m to Medium/ }).element(),
  ).toBeTruthy();
});

test("updates when the run crosses into the next effective difficulty", async () => {
  const screen = await render(<DifficultyMeter />);

  useGameStore.setState((s) => ({ run: { ...s.run, height: 540 } }));

  await expect.element(screen.getByText("Medium")).toBeInTheDocument();
  await expect.element(screen.getByText("660m to Hard")).toBeInTheDocument();
});

test("marks the final cadence when the run reaches Ultimate Blobmare", async () => {
  useWorldStore.getState().reset("difficulty-meter-final", "oneWrongMove");
  const screen = await render(<DifficultyMeter />);

  await expect.element(screen.getByText("Ultimate Blobmare")).toBeInTheDocument();
  await expect.element(screen.getByText("Final cadence")).toBeInTheDocument();
  expect(
    screen
      .getByRole("img", { name: /Current difficulty Ultimate Blobmare, final cadence/ })
      .element(),
  ).toBeTruthy();
});
