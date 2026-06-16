import { FixtureStage } from "@app/fixtures";
import { expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { reportLaunchBurst, resetBridges } from "@/state";
import { LaunchRing } from "../LaunchRing";

// Visual fixture: a reported launch burst must bloom a real (additive) ring in WebGL — the
// in-world "pop" at the pad on release. Before any burst the pool is invisible; after one is
// reported it paints, proving the bridge→pool→expand path is wired.
test("LaunchRing blooms an expanding ring when a launch burst is reported", async () => {
  resetBridges();

  const screen = await render(
    <FixtureStage testId="ring-fixture" cameraDistance={6}>
      <ambientLight intensity={1} />
      <LaunchRing />
    </FixtureStage>,
  );

  await expect.element(screen.getByTestId("ring-fixture")).toBeInTheDocument();
  // Fire a full-charge launch burst at the origin; the next frame grabs a pool slot + expands.
  reportLaunchBurst({ position: [0, 0, 0], charge: 1, kind: "launch" });

  await vi.waitFor(
    () => {
      const canvas = document
        .querySelector('[data-testid="ring-fixture"]')
        ?.querySelector("canvas");
      if (!canvas) throw new Error("canvas not mounted");
      // The additive ring lifts pixels above the cleared background → a non-trivial PNG.
      expect(canvas.toDataURL("image/png").length).toBeGreaterThan(4000);
    },
    { timeout: 4000, interval: 40 },
  );
});

// The same pool also serves the gold LANDING ring (kind: "land") — it must paint too.
test("LaunchRing blooms a landing ring (kind: land) too", async () => {
  resetBridges();

  const screen = await render(
    <FixtureStage testId="land-ring-fixture" cameraDistance={6}>
      <ambientLight intensity={1} />
      <LaunchRing />
    </FixtureStage>,
  );

  await expect.element(screen.getByTestId("land-ring-fixture")).toBeInTheDocument();
  reportLaunchBurst({ position: [0, 0, 0], charge: 0.8, kind: "land" });

  await vi.waitFor(
    () => {
      const canvas = document
        .querySelector('[data-testid="land-ring-fixture"]')
        ?.querySelector("canvas");
      if (!canvas) throw new Error("canvas not mounted");
      expect(canvas.toDataURL("image/png").length).toBeGreaterThan(4000);
    },
    { timeout: 4000, interval: 40 },
  );
});
