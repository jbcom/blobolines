import { render } from "vitest-browser-react";
import { expect, test, vi } from "vitest";
import { FixtureStage } from "@app/fixtures";
import { SkyDome } from "../SkyDome";

// Visual fixture: the painterly sky dome must actually paint colored pixels in a real
// WebGL context (regression guard for the gradient shader material).
test("SkyDome renders and paints the gradient", async () => {
  const screen = await render(
    <FixtureStage testId="sky-fixture" cameraDistance={0.1}>
      <SkyDome />
    </FixtureStage>,
  );

  await expect.element(screen.getByTestId("sky-fixture")).toBeInTheDocument();

  // Let a couple of frames flush so the GL context paints.
  await new Promise((r) => setTimeout(r, 80));

  await vi.waitFor(
    () => {
      const canvas = document.querySelector("canvas");
      if (!canvas) throw new Error("canvas not mounted");
      const dataUrl = canvas.toDataURL("image/png");
      // A non-trivial painted frame is well over a few KB of base64.
      expect(dataUrl.length).toBeGreaterThan(4000);
    },
    { timeout: 5000, interval: 50 },
  );
});
