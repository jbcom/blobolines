import { afterEach, expect, test } from "vitest";
import { cleanup, render } from "vitest-browser-react";
import {
  activatePowerup,
  consumeMidAirBounce,
  getAirSteer,
  resetBridges,
  resetPowerups,
  setAirSteer,
  setBlobDiagnostics,
} from "@/state";
import { LaunchInput } from "../LaunchInput";

afterEach(() => {
  cleanup();
  resetBridges();
  resetPowerups();
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

// At rest (no hold → charge 0) the launch surface shows neither the power bar nor the
// max-charge flourish. The "MAX!" flourish + edge glow only appear under a near-full
// charge, which is driven by a live hold gesture (exercised in e2e, not here).
test("renders the launch surface with no power UI at rest", async () => {
  const screen = await render(<LaunchInput />);
  await expect
    .element(screen.getByRole("application", { name: /hold on the blob/i }))
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

test("airborne drag shows the 3D steer reticle and writes X/Z steering", async () => {
  const screen = await render(<LaunchInput />);
  setAirborne(true);
  const surface = document.querySelector('[role="application"]') as HTMLElement;
  expect(surface).toBeTruthy();

  surface.dispatchEvent(
    new PointerEvent("pointerdown", {
      bubbles: true,
      pointerId: 1,
      pointerType: "touch",
      clientX: 300,
      clientY: 300,
      buttons: 1,
    }),
  );
  surface.dispatchEvent(
    new PointerEvent("pointermove", {
      bubbles: true,
      pointerId: 1,
      pointerType: "touch",
      clientX: 360,
      clientY: 250,
      buttons: 1,
    }),
  );

  await expect.element(screen.getByTestId("air-steer-reticle")).toBeInTheDocument();
  expect(getAirSteer()[0]).toBeGreaterThan(0);
  expect(getAirSteer()[1]).toBeLessThan(0);

  surface.dispatchEvent(
    new PointerEvent("pointerup", {
      bubbles: true,
      pointerId: 1,
      pointerType: "touch",
      clientX: 360,
      clientY: 250,
    }),
  );
  await expect.element(screen.getByTestId("air-steer-reticle").query()).not.toBeInTheDocument();
  expect(getAirSteer()).toEqual([0, 0]);
});

test("airborne tap with a multi-bounce charge hides the reticle and requests the bounce", async () => {
  const screen = await render(<LaunchInput />);
  setAirborne(true);
  activatePowerup("multibounce");
  const surface = document.querySelector('[role="application"]') as HTMLElement;
  expect(surface).toBeTruthy();

  surface.dispatchEvent(
    new PointerEvent("pointerdown", {
      bubbles: true,
      pointerId: 1,
      pointerType: "touch",
      clientX: 300,
      clientY: 300,
      buttons: 1,
    }),
  );

  await expect.element(screen.getByTestId("air-steer-reticle")).toBeInTheDocument();
  setAirSteer(12, -9);

  surface.dispatchEvent(
    new PointerEvent("pointerup", {
      bubbles: true,
      pointerId: 1,
      pointerType: "touch",
      clientX: 300,
      clientY: 300,
    }),
  );

  await expect.element(screen.getByTestId("air-steer-reticle").query()).not.toBeInTheDocument();
  expect(getAirSteer()).toEqual([0, 0]);
  expect(consumeMidAirBounce()).toBe(true);
});
