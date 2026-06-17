import { afterEach, expect, test } from "vitest";
import { cleanup, render } from "vitest-browser-react";
import { useGameStore } from "@/state";
import { TitleScreen } from "../TitleScreen";

afterEach(() => {
  cleanup();
  useGameStore.setState({ phase: "menu", dailyRun: false });
});

test("renders the Play CTA and the Daily Challenge entry", async () => {
  const screen = await render(<TitleScreen />);
  await expect.element(screen.getByRole("button", { name: /^Play/ })).toBeInTheDocument();
  await expect.element(screen.getByRole("button", { name: /Daily Challenge/ })).toBeInTheDocument();
});

test("Daily Challenge starts a daily run (dailyRun true)", async () => {
  useGameStore.setState({ dailyRun: false });
  const screen = await render(<TitleScreen />);
  await screen.getByRole("button", { name: /Daily Challenge/ }).click();
  expect(useGameStore.getState().phase).toBe("playing");
  expect(useGameStore.getState().dailyRun).toBe(true);
});

test("Play starts a normal run (dailyRun false even if a daily flag lingered)", async () => {
  useGameStore.setState({ dailyRun: true }); // a stale daily flag from a prior run
  const screen = await render(<TitleScreen />);
  await screen.getByRole("button", { name: /^Play/ }).click();
  expect(useGameStore.getState().phase).toBe("playing");
  expect(useGameStore.getState().dailyRun).toBe(false); // normal Play clears it
});
