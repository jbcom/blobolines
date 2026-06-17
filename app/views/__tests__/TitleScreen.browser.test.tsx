import { afterEach, expect, test } from "vitest";
import { cleanup, render } from "vitest-browser-react";
import { useGameStore, useWorldStore } from "@/state";
import { TitleScreen } from "../TitleScreen";

afterEach(() => {
  cleanup();
  useGameStore.setState({ phase: "menu", dailyRun: false });
  useWorldStore.getState().reset(1, "ready");
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
  await expect
    .element(screen.getByRole("dialog", { name: /Daily challenge difficulty/ }))
    .toBeInTheDocument();
  await expect.element(screen.getByText(/blobolines-daily-/)).toBeInTheDocument();
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

test("opening Settings lazy-loads + shows the modal through the Suspense boundary", async () => {
  const screen = await render(<TitleScreen />);
  await screen.getByRole("button", { name: /Settings/ }).click();
  // The modal's lazy chunk resolves and its heading appears (it isn't mounted until opened).
  await expect.element(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument();
});
