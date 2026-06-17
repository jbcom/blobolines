import { afterEach, expect, test } from "vitest";
import { cleanup, render } from "vitest-browser-react";
import { getAirSteer, setAirSteer, setBlobDiagnostics } from "@/state";
import { LaunchInput } from "../LaunchInput";

afterEach(() => {
  cleanup();
  setAirSteer(0, 0);
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

const setAirborne = (on: boolean) =>
  setBlobDiagnostics({
    position: [0, on ? 10 : 0, 0],
    velocity: [0, on ? 5 : 0, 0],
    speed: on ? 5 : 0,
    airborne: on,
    expression: "idle",
    squash: 1,
    maxHeight: on ? 10 : 0,
    groundY: 0,
  });

// At rest (no drag → charge 0) the launch surface shows neither the power bar nor the
// max-charge flourish. The "MAX!" flourish + edge glow only appear under a near-full
// charge, which is driven by a live drag gesture (exercised in e2e, not here).
test("renders the launch surface with no power UI at rest", async () => {
  const screen = await render(<LaunchInput />);
  await expect
    .element(screen.getByRole("application", { name: /drag back to aim/i }))
    .toBeInTheDocument();
  await expect.element(screen.getByText("Max!").query()).not.toBeInTheDocument();
  await expect.element(screen.getByRole("progressbar").query()).not.toBeInTheDocument();
});

// Keyboard air-steering (useKeyboardSteer, mounted by LaunchInput): an arrow/WASD key held
// while AIRBORNE writes a lateral steer accel into the input bridge; releasing clears it.
test("keyboard steers the airborne blob (ArrowRight → +X accel), clears on keyup", async () => {
  await render(<LaunchInput />);
  setAirborne(true);

  window.dispatchEvent(new KeyboardEvent("keydown", { code: "ArrowRight" }));
  expect(getAirSteer()[0]).toBeGreaterThan(0); // +X accel while held

  window.dispatchEvent(new KeyboardEvent("keyup", { code: "ArrowRight" }));
  expect(getAirSteer()).toEqual([0, 0]); // cleared on release

  // W = forward (−Z).
  window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyW" }));
  expect(getAirSteer()[1]).toBeLessThan(0);
  window.dispatchEvent(new KeyboardEvent("keyup", { code: "KeyW" }));
});

test("keyboard steering is inert when the blob is resting (not airborne)", async () => {
  await render(<LaunchInput />);
  setAirborne(false);
  window.dispatchEvent(new KeyboardEvent("keydown", { code: "ArrowLeft" }));
  expect(getAirSteer()).toEqual([0, 0]); // no steering on a grounded blob
  window.dispatchEvent(new KeyboardEvent("keyup", { code: "ArrowLeft" }));
});
