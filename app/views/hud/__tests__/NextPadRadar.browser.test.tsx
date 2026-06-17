import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render } from "vitest-browser-react";
import type { TrampolineSpec } from "@/core/types";
import { setBlobDiagnostics, useWorldStore } from "@/state";
import { NextPadRadar, nextPadGuidance } from "../NextPadRadar";

const starter: TrampolineSpec = {
  id: 0,
  position: [0, 0, 0],
  width: 7.5,
  depth: 7.5,
  type: "standard",
};

const nextRightForward: TrampolineSpec = {
  id: 8,
  position: [4, 8, -3],
  width: 8.4,
  depth: 8.4,
  type: "standard",
};

const laterPad: TrampolineSpec = {
  id: 18,
  position: [-2, 18, 4],
  width: 7,
  depth: 7,
  type: "standard",
};

function setDiag(position: [number, number, number], groundY: number) {
  setBlobDiagnostics({
    position,
    velocity: [0, 0, 0],
    speed: 0,
    airborne: false,
    expression: "idle",
    squash: 1,
    maxHeight: Math.max(0, position[1]),
    groundY,
  });
}

afterEach(() => {
  cleanup();
  useWorldStore.getState().reset(1, "ready");
  setDiag([0, 0, 0], 0);
});

test("nextPadGuidance points to the first pad above the landed progression floor", () => {
  const guidance = nextPadGuidance([0, 1.46, 0], 1.46, [starter, nextRightForward, laterPad]);
  expect(guidance?.target).toBe(nextRightForward);
  expect(guidance?.direction).toBe("forward right");
  expect(guidance?.dy).toBeCloseTo(6.54, 2);
  expect(guidance?.horizontal).toBeCloseTo(5, 5);
  expect(guidance?.headingDeg).toBeGreaterThan(0);
});

test("nextPadGuidance selects the lowest valid pad even if the array is unordered", () => {
  const guidance = nextPadGuidance([0, 1.46, 0], 1.46, [laterPad, starter, nextRightForward]);
  expect(guidance?.target).toBe(nextRightForward);
});

test("nextPadGuidance holds the same intended pad while the blob arcs above it", () => {
  const guidance = nextPadGuidance([1, 14, -1], 1.46, [starter, nextRightForward, laterPad]);
  expect(guidance?.target).toBe(nextRightForward);
  expect(guidance?.dy).toBeLessThan(0);
});

test("NextPadRadar does not render tiny negative vertical gaps as -0m", async () => {
  const nearlyLevel: TrampolineSpec = {
    ...nextRightForward,
    id: 9,
    position: [4, 1.2, -3],
  };
  useWorldStore.setState({ trampolines: [starter, nearlyLevel] });
  setDiag([0, 1.46, 0], 0);

  const screen = await render(<NextPadRadar />);
  const radar = screen.getByTestId("next-pad-radar");

  await vi.waitFor(
    () => {
      expect(radar.element().style.opacity).toBe("1");
      expect(radar.element().textContent).toContain("+0m");
      expect(radar.element().textContent).not.toContain("-0m");
    },
    { timeout: 2000, interval: 40 },
  );
});

test("NextPadRadar renders live direction, vertical gap, and horizontal distance", async () => {
  useWorldStore.setState({ trampolines: [starter, nextRightForward, laterPad] });
  setDiag([0, 1.46, 0], 1.46);

  const screen = await render(<NextPadRadar />);
  const radar = screen.getByTestId("next-pad-radar");

  await vi.waitFor(
    () => {
      expect(radar.element().style.opacity).toBe("1");
      expect(radar.element().textContent).toContain("forward right");
      expect(radar.element().textContent).toContain("+7m");
      expect(radar.element().textContent).toContain("5m");
      expect(radar.element().getAttribute("aria-label")).toContain("Next trampoline forward right");
    },
    { timeout: 2000, interval: 40 },
  );
});

test("NextPadRadar hides when no pad is above the progression floor", async () => {
  useWorldStore.setState({ trampolines: [starter] });
  setDiag([0, 1.46, 0], 1.46);

  const screen = await render(<NextPadRadar />);
  const radar = screen.getByTestId("next-pad-radar");

  await vi.waitFor(
    () => {
      expect(radar.element().style.opacity).toBe("0");
      expect(radar.element().getAttribute("aria-label")).toBe("No next trampoline target");
    },
    { timeout: 2000, interval: 40 },
  );
});
