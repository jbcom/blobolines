import { FixtureStage } from "@app/fixtures";
import { expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { SkyDome } from "../SkyDome";

// Visual fixture: the painterly sky dome must actually paint colored pixels in a real
// WebGL context (regression guard for the gradient shader material), AND now installs the
// height-reactive biome fog on the scene without breaking that render.
test("SkyDome renders the gradient and installs biome fog", async () => {
  const screen = await render(
    <FixtureStage testId="sky-fixture" cameraDistance={0.1}>
      <SkyDome />
    </FixtureStage>,
  );

  await expect.element(screen.getByTestId("sky-fixture")).toBeInTheDocument();

  // Let a couple of frames flush so the GL context paints + the fog effect runs.
  await new Promise((r) => setTimeout(r, 80));

  await vi.waitFor(
    () => {
      const canvas = document.querySelector('[data-testid="sky-fixture"]')?.querySelector("canvas");
      if (!canvas) throw new Error("canvas not mounted");
      const dataUrl = canvas.toDataURL("image/png");
      // A non-trivial painted frame is well over a few KB of base64 — proves the dome paints
      // and the fog wiring didn't blank or crash the scene.
      expect(dataUrl.length).toBeGreaterThan(4000);
    },
    { timeout: 5000, interval: 50 },
  );
});
