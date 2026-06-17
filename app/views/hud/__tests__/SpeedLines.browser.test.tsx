import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render } from "vitest-browser-react";
import { setBlobDiagnostics } from "@/state";
import { SpeedLines } from "../SpeedLines";

afterEach(() => {
  cleanup();
  setBlobDiagnostics({
    position: [0, 0, 0],
    velocity: [0, 0, 0],
    speed: 0,
    airborne: false,
    expression: "idle",
    squash: 1,
    maxHeight: 0,
    groundY: 0,
  });
});

// Speed streaks fade in only above the velocity threshold: at rest the overlay is invisible,
// at high speed its opacity ramps up. (Skipped automatically under reduced-motion, which the
// browser test env doesn't set.)
test("SpeedLines fades in at high blob speed, invisible at rest", async () => {
  setBlobDiagnostics({
    position: [0, 0, 0],
    velocity: [0, 40, 0],
    speed: 40,
    airborne: true,
    expression: "wide",
    squash: 1,
    maxHeight: 0,
    groundY: 0,
  });

  const { container } = await render(<SpeedLines />);
  const overlay = container.firstElementChild as HTMLElement;
  expect(overlay).toBeTruthy();

  // rAF loop ramps opacity toward MAX_OPACITY at full speed.
  await vi.waitFor(
    () => {
      expect(Number(overlay.style.opacity)).toBeGreaterThan(0.1);
    },
    { timeout: 2000, interval: 40 },
  );

  // Drop to rest → streaks fade back out.
  setBlobDiagnostics({
    position: [0, 0, 0],
    velocity: [0, 0, 0],
    speed: 0,
    airborne: false,
    expression: "idle",
    squash: 1,
    maxHeight: 0,
    groundY: 0,
  });
  await vi.waitFor(
    () => {
      expect(Number(overlay.style.opacity)).toBeLessThan(0.02);
    },
    { timeout: 2000, interval: 40 },
  );
});
