import { FixtureStage } from "@app/fixtures";
import { afterEach, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import type { TrampolineSpec } from "@/core/types";
import { setBlobDiagnostics, useWorldStore } from "@/state";
import { LandingTargetMarker } from "../LandingTargetMarker";

const target: TrampolineSpec = {
  id: 4,
  routeIndex: 1,
  position: [0, 4, 0],
  width: 7,
  depth: 7,
  type: "moving",
};

const source: TrampolineSpec = {
  id: 0,
  routeIndex: 0,
  position: [0, 0, 0],
  width: 7.5,
  depth: 7.5,
  type: "standard",
  goldenPath: {
    toPadId: target.id,
    launchNormal: [0, 1, 0],
    launchSpeed: 30,
    flightTime: 0.35,
    apex: [0, 5.2, 0],
    landing: [0, 4.72, 0],
    clearance: 2.5,
    samples: [
      [0, 0.72, 0],
      [0, 4.72, 0],
    ],
    requiredCant: false,
    sourceMode: "flat",
    launchAngleRad: 0,
    landingPrecision: 1,
    lipClearance: 2.5,
    lipClearanceRatio: 0.7,
    arcCompression: 0.25,
  },
};

afterEach(() => {
  useWorldStore.setState({ trampolines: [] });
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

test("LandingTargetMarker paints the certified landing bullseye in WebGL", async () => {
  useWorldStore.setState({ trampolines: [source, target] });
  setBlobDiagnostics({
    position: [0, 1.46, 0],
    velocity: [0, 0, 0],
    speed: 0,
    airborne: false,
    expression: "idle",
    squash: 1,
    maxHeight: 0,
    groundY: 0,
  });

  const screen = await render(
    <FixtureStage testId="landing-target-fixture" cameraDistance={10}>
      <ambientLight intensity={1} />
      <LandingTargetMarker />
    </FixtureStage>,
  );

  await expect.element(screen.getByTestId("landing-target-fixture")).toBeInTheDocument();
  await vi.waitFor(
    () => {
      const canvas = document
        .querySelector('[data-testid="landing-target-fixture"]')
        ?.querySelector("canvas");
      if (!canvas) throw new Error("canvas not mounted");
      expect(canvas.toDataURL("image/png").length).toBeGreaterThan(4000);
    },
    { timeout: 6000, interval: 60 },
  );
});
