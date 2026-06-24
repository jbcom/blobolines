import { afterEach, expect, test } from "vitest";
import { cleanup, render } from "vitest-browser-react";
import { consumeFlash, DEFAULT_SETTINGS, flash, resetFlash, useGameStore } from "@/state";
import { ScreenFlash } from "../ScreenFlash";

afterEach(() => {
  cleanup();
  resetFlash();
  useGameStore.setState({ settings: { ...DEFAULT_SETTINGS } });
});

test("ScreenFlash consumes flashes without displaying them when in-app reduced motion is enabled", async () => {
  useGameStore.setState({ settings: { ...DEFAULT_SETTINGS, reducedMotion: true } });
  const { container } = await render(<ScreenFlash />);
  const overlay = container.firstElementChild as HTMLElement;
  expect(overlay).toBeTruthy();

  flash("gold", 1);
  await new Promise((resolve) => setTimeout(resolve, 120));

  expect(consumeFlash()).toBeNull();
  expect(Number(overlay.style.opacity)).toBe(0);
});
