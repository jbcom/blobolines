import { FixtureStage } from "@app/fixtures";
import { afterEach, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import type { RouteGateSpec, TrampolineSpec } from "@/core/types";
import { consumeRouteGateHit, resetBridges, setBlobDiagnostics, useWorldStore } from "@/state";
import { RouteGateField } from "../RouteGateField";

function fixtureGate(): RouteGateSpec {
  return {
    id: "fixture-gate",
    kind: "phasePortal",
    sourcePadId: 1,
    targetPadId: 2,
    routeIndex: 6,
    sampleIndex: 1,
    position: [0, 0, 0],
    normal: [0, 0, 1],
    radius: 1.45,
    period: 100,
    openFraction: 0.1,
    phaseOffset: 0.6,
    flightTime: 0.5,
    idealReleaseDelay: 0.2,
  };
}

function fixtureSlicer(): RouteGateSpec {
  return {
    ...fixtureGate(),
    id: "fixture-slicer",
    kind: "slicer",
    period: 0,
    openFraction: 0,
    phaseOffset: 0,
    fragmentCount: 4,
    splitSpread: 3.2,
    fragmentLanes: [
      {
        index: 0,
        survivor: true,
        samples: [
          [0, 0, 0],
          [0, 0.6, 0],
          [0, 1, 0],
        ],
        landing: [0, 1, 0],
        landingPrecision: 1,
        exitVelocity: [0, 6, 0],
        duration: 0.7,
      },
      {
        index: 1,
        survivor: false,
        samples: [
          [0, 0, 0],
          [-0.7, 0.6, 0],
          [-0.2, 1, 0],
        ],
        landing: [-0.2, 1, 0],
        landingPrecision: 0.9,
        exitVelocity: [-3, 5, 0],
        duration: 0.7,
      },
    ],
  };
}

function padWithGate(gate = fixtureGate()): TrampolineSpec {
  return {
    id: gate.sourcePadId,
    routeIndex: gate.routeIndex,
    position: [0, -2, 0],
    width: 5,
    depth: 5,
    type: "standard",
    goldenPath: {
      toPadId: gate.targetPadId,
      launchNormal: [0, 1, 0],
      launchSpeed: 20,
      launchCharge: 0.8,
      flightTime: 1,
      apex: [0, 4, 0],
      landing: [0, 1, 0],
      clearance: 1,
      samples: [[0, -1, 0], gate.position, [0, 1, 0]],
      requiredCant: false,
      sourceMode: "flat",
      launchAngleRad: 0,
      landingPrecision: 1,
      lipClearance: 1,
      lipClearanceRatio: 0.2,
      arcCompression: 0,
      variants: [],
      routeGate: gate,
    },
  };
}

afterEach(() => {
  useWorldStore.setState({ trampolines: [], seed: 1, seedPhrase: "seed-1", runId: 0 });
  setBlobDiagnostics({
    position: [0, -999, 0],
    velocity: [0, 0, 0],
    speed: 0,
    airborne: false,
    expression: "idle",
    squash: 1,
    maxHeight: 0,
    groundY: 0,
  });
  resetBridges();
});

test("RouteGateField renders a phasing vertical portal", async () => {
  useWorldStore.setState({ trampolines: [padWithGate()] });
  setBlobDiagnostics({
    position: [3, 0, 0],
    velocity: [0, 0, 0],
    speed: 0,
    airborne: true,
    expression: "idle",
    squash: 1,
    maxHeight: 0,
    groundY: 0,
  });

  const screen = await render(
    <FixtureStage testId="route-gate-fixture" cameraDistance={5}>
      <RouteGateField />
    </FixtureStage>,
  );

  await expect.element(screen.getByTestId("route-gate-fixture")).toBeInTheDocument();
  await vi.waitFor(
    () => {
      const canvas = document
        .querySelector('[data-testid="route-gate-fixture"]')
        ?.querySelector("canvas");
      if (!canvas) throw new Error("canvas not mounted");
      expect(canvas.toDataURL("image/png").length).toBeGreaterThan(4000);
    },
    { timeout: 6000, interval: 60 },
  );
});

test("RouteGateField reports a hit when the blob enters a closed portal", async () => {
  const gate = fixtureGate();
  useWorldStore.setState({ trampolines: [padWithGate(gate)] });
  setBlobDiagnostics({
    position: gate.position,
    velocity: [0, 0, 0],
    speed: 0,
    airborne: true,
    expression: "idle",
    squash: 1,
    maxHeight: 0,
    groundY: 0,
  });

  await render(
    <FixtureStage testId="route-gate-hit-fixture" cameraDistance={5}>
      <RouteGateField />
    </FixtureStage>,
  );

  await vi.waitFor(
    () => {
      expect(consumeRouteGateHit()?.gateId).toBe(gate.id);
    },
    { timeout: 6000, interval: 60 },
  );
});

test("RouteGateField reports split metadata when the blob enters a slicer", async () => {
  const gate = fixtureSlicer();
  useWorldStore.setState({ trampolines: [padWithGate(gate)] });
  setBlobDiagnostics({
    position: gate.position,
    velocity: [2, 8, -1],
    speed: 8.3,
    airborne: true,
    expression: "wide",
    squash: 1,
    maxHeight: 0,
    groundY: 0,
  });

  await render(
    <FixtureStage testId="route-gate-slicer-fixture" cameraDistance={5}>
      <RouteGateField />
    </FixtureStage>,
  );

  await vi.waitFor(
    () => {
      const hit = consumeRouteGateHit();
      expect(hit?.gateId).toBe(gate.id);
      expect(hit?.kind).toBe("slicer");
      expect(hit?.fragmentCount).toBe(4);
      expect(hit?.fragmentLanes?.[0]?.survivor).toBe(true);
      expect(hit?.velocity).toEqual([2, 8, -1]);
    },
    { timeout: 6000, interval: 60 },
  );
});

test("RouteGateField does not report a hit when an open portal closes around the blob", async () => {
  const gate = {
    ...fixtureGate(),
    id: "open-then-closed-gate",
    period: 1,
    openFraction: 0.7,
    phaseOffset: 0,
  };
  useWorldStore.setState({ trampolines: [padWithGate(gate)] });
  setBlobDiagnostics({
    position: gate.position,
    velocity: [0, 0, 0],
    speed: 0,
    airborne: true,
    expression: "idle",
    squash: 1,
    maxHeight: 0,
    groundY: 0,
  });

  await render(
    <FixtureStage testId="route-gate-open-fixture" cameraDistance={5}>
      <RouteGateField />
    </FixtureStage>,
  );

  await new Promise((r) => setTimeout(r, 950));
  expect(consumeRouteGateHit()).toBeNull();
});
