import { FixtureStage } from "@app/fixtures";
import { expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import type { Droplet } from "@/render/vfx";
import { FreeDroplets } from "../FreeDroplets";

// Visual fixture: flung droplets render as instanced wet spheres in WebGL (so a splash throws
// visible goo). A handful of live droplets spread out in space must paint real pixels.
test("FreeDroplets renders flung droplets as instanced wet spheres", async () => {
  const drops: Droplet[] = [
    { position: [1.2, 0.5, 0], velocity: [0, 0, 0], radius: 0.4, age: 0, life: 1 },
    { position: [-1, 0.8, 0.5], velocity: [0, 0, 0], radius: 0.35, age: 0.1, life: 1 },
    { position: [0.3, -0.6, -0.8], velocity: [0, 0, 0], radius: 0.3, age: 0.2, life: 1 },
  ];

  const screen = await render(
    <FixtureStage testId="droplets-fixture" cameraDistance={5}>
      <ambientLight intensity={1.2} />
      <directionalLight position={[2, 3, 2]} intensity={1} />
      <FreeDroplets skin="slime" getDroplets={() => drops} />
    </FixtureStage>,
  );

  await expect.element(screen.getByTestId("droplets-fixture")).toBeInTheDocument();
  await new Promise((r) => setTimeout(r, 120));

  await vi.waitFor(
    () => {
      const canvas = document
        .querySelector('[data-testid="droplets-fixture"]')
        ?.querySelector("canvas");
      if (!canvas) throw new Error("canvas not mounted");
      expect(canvas.toDataURL("image/png").length).toBeGreaterThan(4000);
    },
    { timeout: 6000, interval: 60 },
  );
});
