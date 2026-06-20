import { afterEach, beforeEach, expect, test } from "vitest";
import { cleanup, render } from "vitest-browser-react";
import { useGameStore } from "@/state";
import { PauseOverlay } from "../PauseOverlay";

beforeEach(() => {
  useGameStore.setState({ phase: "paused" });
});
afterEach(() => {
  cleanup();
  useGameStore.setState({ phase: "menu" });
});

test("shows the pause card with Resume / Settings / Quit", async () => {
  const screen = await render(<PauseOverlay />);
  await expect.element(screen.getByText("Paused")).toBeInTheDocument();
  await expect.element(screen.getByRole("button", { name: /resume/i })).toBeInTheDocument();
  await expect.element(screen.getByRole("button", { name: /settings/i })).toBeInTheDocument();
  await expect.element(screen.getByRole("button", { name: /quit to menu/i })).toBeInTheDocument();
});

test("Resume returns the game to playing (the run resumes where it froze)", async () => {
  const screen = await render(<PauseOverlay />);
  await screen.getByRole("button", { name: /resume/i }).click();
  expect(useGameStore.getState().phase).toBe("playing");
});

test("Quit to menu ends the run and returns to the menu", async () => {
  const screen = await render(<PauseOverlay />);
  await screen.getByRole("button", { name: /quit to menu/i }).click();
  expect(useGameStore.getState().phase).toBe("menu");
});
