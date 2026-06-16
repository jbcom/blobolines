import { FixtureStage } from "@app/fixtures";
import { Physics } from "@react-three/rapier";
import { expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { Trampoline } from "../Trampoline";

// Visual fixture: a trampoline (springy pad + glossy membrane + goo-splat decal plane)
// renders painted pixels in a real WebGL context. Regression guard that the decal mesh +
// CanvasTexture material compile and the pad draws (it needs a <Physics> provider for its
// Rapier body, like the in-game scene).
test("Trampoline renders the pad with its splat-decal surface", async () => {
  const screen = await render(
    <FixtureStage testId="tramp-fixture" cameraDistance={10}>
      <Physics paused gravity={[0, -22, 0]}>
        <Trampoline position={[0, 0, 0]} width={6} depth={6} type="standard" />
      </Physics>
    </FixtureStage>,
  );

  await expect.element(screen.getByTestId("tramp-fixture")).toBeInTheDocument();
  await new Promise((r) => setTimeout(r, 100));

  await vi.waitFor(
    () => {
      const canvas = document
        .querySelector('[data-testid="tramp-fixture"]')
        ?.querySelector("canvas");
      if (!canvas) throw new Error("canvas not mounted");
      expect(canvas.toDataURL("image/png").length).toBeGreaterThan(4000);
    },
    { timeout: 8000, interval: 100 },
  );
});
