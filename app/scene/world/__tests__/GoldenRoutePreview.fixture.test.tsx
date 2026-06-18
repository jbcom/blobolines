import { FixtureStage } from "@app/fixtures";
import { afterEach, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { setRouteProofTarget, useWorldStore } from "@/state";
import { GoldenRoutePreview } from "../GoldenRoutePreview";

afterEach(() => {
  setRouteProofTarget(null);
  useWorldStore.getState().reset("bouncy-bright-blob", "ready");
});

test("GoldenRoutePreview renders the certified route proof in WebGL", async () => {
  setRouteProofTarget({ pairIndex: 0 });

  const screen = await render(
    <FixtureStage testId="golden-route-fixture" cameraDistance={16}>
      <group position={[0, -4, 0]}>
        <GoldenRoutePreview />
      </group>
    </FixtureStage>,
  );

  await expect.element(screen.getByTestId("golden-route-fixture")).toBeInTheDocument();
  await new Promise((r) => setTimeout(r, 120));

  await vi.waitFor(
    () => {
      const canvas = document
        .querySelector('[data-testid="golden-route-fixture"]')
        ?.querySelector("canvas");
      if (!canvas) throw new Error("canvas not mounted");
      expect(canvas.toDataURL("image/png").length).toBeGreaterThan(4000);
    },
    { timeout: 6000, interval: 60 },
  );
});

test("GoldenRoutePreview renders certified slicer fragment lanes", async () => {
  setRouteProofTarget({ pairIndex: 0 });
  useWorldStore.setState({
    seed: 42,
    seedPhrase: "slicer-lane-fixture",
    trampolines: [
      {
        id: 1,
        routeIndex: 6,
        position: [-3, -3, 0],
        width: 5,
        depth: 5,
        type: "standard",
        goldenPath: {
          toPadId: 2,
          launchNormal: [0.25, 0.92, 0],
          launchSpeed: 22,
          launchCharge: 0.7,
          flightTime: 1.4,
          apex: [0, 3, 0],
          landing: [3, 1, 0],
          clearance: 1,
          samples: [
            [-3, -2.2, 0],
            [-1.6, 0.8, 0],
            [0, 1.5, 0],
            [1.6, 1.2, 0],
            [3, 0.7, 0],
          ],
          requiredCant: false,
          sourceMode: "flat",
          launchAngleRad: 0.4,
          landingPrecision: 1,
          lipClearance: 1,
          lipClearanceRatio: 0.4,
          arcCompression: 0.2,
          variants: [],
          routeGate: {
            id: "fixture-slicer-lanes",
            kind: "slicer",
            sourcePadId: 1,
            targetPadId: 2,
            routeIndex: 6,
            sampleIndex: 2,
            position: [0, 1.5, 0],
            normal: [1, 0, 0],
            radius: 1.4,
            period: 0,
            openFraction: 0,
            phaseOffset: 0,
            flightTime: 0.7,
            idealReleaseDelay: 0,
            fragmentCount: 3,
            splitSpread: 3,
            fragmentLanes: [
              {
                index: 0,
                survivor: true,
                samples: [
                  [0, 1.5, 0],
                  [1.6, 1.2, 0],
                  [3, 0.7, 0],
                ],
                landing: [3, 0.7, 0],
                landingPrecision: 1,
                exitVelocity: [5, -1, 0],
                duration: 0.7,
              },
              {
                index: 1,
                survivor: false,
                samples: [
                  [0, 1.5, 0],
                  [1.6, 1.2, -0.7],
                  [3, 0.7, -0.25],
                ],
                landing: [3, 0.7, -0.25],
                landingPrecision: 0.8,
                exitVelocity: [5, -1, -2],
                duration: 0.7,
              },
              {
                index: 2,
                survivor: false,
                samples: [
                  [0, 1.5, 0],
                  [1.6, 1.2, 0.7],
                  [3, 0.7, 0.25],
                ],
                landing: [3, 0.7, 0.25],
                landingPrecision: 0.8,
                exitVelocity: [5, -1, 2],
                duration: 0.7,
              },
            ],
          },
        },
      },
      {
        id: 2,
        routeIndex: 7,
        position: [3, 0, 0],
        width: 5,
        depth: 5,
        type: "canted",
      },
    ],
  });

  const screen = await render(
    <FixtureStage testId="slicer-lanes-fixture" cameraDistance={10}>
      <group position={[0, 0, 0]}>
        <GoldenRoutePreview />
      </group>
    </FixtureStage>,
  );

  await expect.element(screen.getByTestId("slicer-lanes-fixture")).toBeInTheDocument();
  await vi.waitFor(
    () => {
      const canvas = document
        .querySelector('[data-testid="slicer-lanes-fixture"]')
        ?.querySelector("canvas");
      if (!canvas) throw new Error("canvas not mounted");
      expect(canvas.toDataURL("image/png").length).toBeGreaterThan(4000);
    },
    { timeout: 6000, interval: 60 },
  );
});
