import { FixtureStage } from "@app/fixtures";
import { afterEach, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { setBlobDiagnostics } from "@/state";
import { BiomeGeometry } from "../BiomeGeometry";

function setAltitude(y: number) {
  setBlobDiagnostics({
    position: [0, y, 0],
    velocity: [0, 0, 0],
    speed: 0,
    airborne: true,
    expression: "idle",
    squash: 1,
    maxHeight: y,
    groundY: 0,
  });
}

afterEach(() => setAltitude(0));

// Each parallax layer (hills / floating islands / satellites) is altitude-windowed, so verify
// the component renders real pixels — without erroring on the instanced-matrix updates — at a
// height inside each band. Camera pulled back + aimed down -Z where the far layers sit.
async function expectPaints(testId: string, altitude: number) {
  setAltitude(altitude);
  await render(
    <FixtureStage testId={testId} cameraDistance={60}>
      <ambientLight intensity={1} />
      <BiomeGeometry />
    </FixtureStage>,
  );
  await new Promise((r) => setTimeout(r, 120));
  await vi.waitFor(
    () => {
      const canvas = document.querySelector(`[data-testid="${testId}"]`)?.querySelector("canvas");
      if (!canvas) throw new Error("canvas not mounted");
      expect(canvas.toDataURL("image/png").length).toBeGreaterThan(4000);
    },
    { timeout: 6000, interval: 60 },
  );
}

test("renders ground-band hills", async () => {
  await expectPaints("biomegeo-ground", 60);
});

test("renders mid-band floating islands", async () => {
  await expectPaints("biomegeo-mid", 500);
});

test("renders space-band satellites", async () => {
  await expectPaints("biomegeo-space", 1100);
});
