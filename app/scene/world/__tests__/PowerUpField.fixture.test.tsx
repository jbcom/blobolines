import { FixtureStage } from "@app/fixtures";
import { afterEach, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { setBlobDiagnostics, useWorldStore } from "@/state";
import { PowerUpField } from "../PowerUpField";

afterEach(() => {
  useWorldStore.setState({ powerups: [] });
});

// Visual fixture: a power-up renders with its attract aura halo (additive billboard) in WebGL.
// The GLB model streams in behind a Suspense fallback (the primitive), and the aura disc is a
// sibling — so the field must paint real pixels even before/without the GLB.
test("PowerUpField renders a power-up with its attract aura", async () => {
  useWorldStore.setState({ powerups: [{ position: [0, 0, 0], type: "magnet" }] });
  setBlobDiagnostics({
    position: [3, 0, 0], // a few units away → aura in its "near" attract state
    velocity: [0, 0, 0],
    speed: 0,
    airborne: true,
    expression: "idle",
    squash: 1,
    maxHeight: 0,
    groundY: 0,
  });

  const screen = await render(
    <FixtureStage testId="powerup-fixture" cameraDistance={5}>
      <ambientLight intensity={1} />
      <PowerUpField />
    </FixtureStage>,
  );

  await expect.element(screen.getByTestId("powerup-fixture")).toBeInTheDocument();
  await new Promise((r) => setTimeout(r, 150));

  await vi.waitFor(
    () => {
      const canvas = document
        .querySelector('[data-testid="powerup-fixture"]')
        ?.querySelector("canvas");
      if (!canvas) throw new Error("canvas not mounted");
      expect(canvas.toDataURL("image/png").length).toBeGreaterThan(4000);
    },
    { timeout: 6000, interval: 60 },
  );
});
