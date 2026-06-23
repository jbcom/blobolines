import { FixtureStage } from "@app/fixtures";
import { afterEach, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { setAirSteer, setBlobDiagnostics } from "@/state";
import { AirAimPreview } from "../AirAimPreview";

afterEach(() => {
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
    idleSeconds: 0,
    excitement: 0,
  });
});

// The mid-air aim arc must render its predicted path in WebGL while the blob is airborne AND the
// player is steering — that's the whole point ("know from the arc where it is heading"). The
// headless tab throttles rAF, so this deterministic fixture is how the arc render is proven.

test("renders the predicted aim arc while airborne and steering", async () => {
  setBlobDiagnostics({
    position: [0, 0, 0],
    velocity: [2, 14, 0],
    speed: 14,
    airborne: true,
    expression: "wide",
    squash: 1,
    maxHeight: 10,
    groundY: 0,
    idleSeconds: 0,
    excitement: 0,
  });
  setAirSteer(12, 0); // steering right — the arc should bend that way

  const screen = await render(
    <FixtureStage testId="air-aim-fixture" cameraDistance={18}>
      <group position={[0, -4, 0]}>
        <AirAimPreview />
      </group>
    </FixtureStage>,
  );

  await expect.element(screen.getByTestId("air-aim-fixture")).toBeInTheDocument();
  await vi.waitFor(
    () => {
      const canvas = document
        .querySelector('[data-testid="air-aim-fixture"]')
        ?.querySelector("canvas");
      if (!canvas) throw new Error("canvas not mounted");
      expect(canvas.toDataURL("image/png").length).toBeGreaterThan(4000);
    },
    { timeout: 6000, interval: 60 },
  );
});
