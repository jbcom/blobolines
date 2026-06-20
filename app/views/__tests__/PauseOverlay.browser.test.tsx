import { afterEach, beforeEach, expect, test, vi } from "vitest";
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

test("Escape resumes the run while the overlay is the top layer", async () => {
  await render(<PauseOverlay />);
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  await vi.waitFor(() => expect(useGameStore.getState().phase).toBe("playing"));
});

test("Escape does NOT resume while Settings is open — it closes Settings instead", async () => {
  const screen = await render(<PauseOverlay />);
  // Open the Settings modal layered over the pause overlay.
  await screen.getByRole("button", { name: /settings/i }).click();
  await expect.element(screen.getByRole("dialog", { name: /settings/i })).toBeInTheDocument();
  // While Settings is open, the overlay's resume listener is unmounted, so Escape must NOT resume
  // the run (the modal owns that Escape to close itself). Phase stays paused.
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  // Give any (incorrect) resume a chance to fire before asserting it did not.
  await new Promise((r) => setTimeout(r, 50));
  expect(useGameStore.getState().phase).toBe("paused");
});
