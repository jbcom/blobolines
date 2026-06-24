import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render } from "vitest-browser-react";
import { type HazardDiagnostics, setBlobDiagnostics } from "@/state";
import { HazardReadout, hazardReadoutState } from "../HazardReadout";

const calmHazards: HazardDiagnostics = {
  wind: [0, 0],
  windStrength: 0,
  windIntensity: 0,
  downdraft: 0,
  downdraftIntensity: 0,
};

function setHazards(hazards: HazardDiagnostics) {
  setBlobDiagnostics({
    position: [0, 1000, 0],
    velocity: [0, 4, 0],
    speed: 4,
    airborne: true,
    expression: "wide",
    squash: 1,
    maxHeight: 1000,
    groundY: 980,
    hazards,
  });
}

afterEach(() => {
  cleanup();
  setHazards(calmHazards);
});

test("hazardReadoutState stays hidden while the climb is calm", () => {
  expect(hazardReadoutState(calmHazards)).toBeNull();
});

test("hazardReadoutState names wind direction and normalized force", () => {
  const state = hazardReadoutState({
    wind: [5, -5],
    windStrength: Math.hypot(5, -5),
    windIntensity: 0.62,
    downdraft: 3,
    downdraftIntensity: 0.25,
  });

  expect(state).toMatchObject({
    windActive: true,
    downdraftActive: true,
    windDirection: "forward right",
    windPercent: "62%",
    downdraftPercent: "25%",
  });
  expect(state?.ariaLabel).toContain("wind pushing forward right at 62%");
  expect(state?.ariaLabel).toContain("downdraft at 25%");
});

test("HazardReadout renders live wind force and accessible direction", async () => {
  setHazards({
    wind: [6, 0],
    windStrength: 6,
    windIntensity: 6 / 9,
    downdraft: 0,
    downdraftIntensity: 0,
  });

  const screen = await render(<HazardReadout />);
  const readout = screen.getByTestId("hazard-readout");

  await vi.waitFor(
    () => {
      expect(readout.element().style.opacity).toBe("1");
      expect(readout.element().textContent).toContain("Wind");
      expect(readout.element().textContent).toContain("67%");
      expect(readout.element().getAttribute("aria-label")).toContain("wind pushing right");
    },
    { timeout: 2000, interval: 40 },
  );
});

test("HazardReadout updates when downdraft takes over", async () => {
  setHazards(calmHazards);
  const screen = await render(<HazardReadout />);
  const readout = screen.getByTestId("hazard-readout");

  await vi.waitFor(
    () => {
      expect(readout.element().style.opacity).toBe("0");
    },
    { timeout: 2000, interval: 40 },
  );

  setHazards({
    wind: [0, 0],
    windStrength: 0,
    windIntensity: 0,
    downdraft: 8,
    downdraftIntensity: 8 / 12,
  });

  await vi.waitFor(
    () => {
      expect(readout.element().style.opacity).toBe("1");
      expect(readout.element().textContent).toContain("Downdraft");
      expect(readout.element().textContent).toContain("67%");
      expect(readout.element().getAttribute("aria-label")).toBe("Climb hazards: downdraft at 67%");
    },
    { timeout: 2000, interval: 40 },
  );
});
