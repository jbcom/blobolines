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
