import { FixtureStage } from "@app/fixtures";
import { afterEach, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import type { Droplet } from "@/render/vfx";
import { setBlobDiagnostics } from "@/state";
import { FreeDroplets } from "../FreeDroplets";

afterEach(() => {
  setBlobDiagnostics({
    position: [0, 0, 0],
    velocity: [0, 0, 0],
    speed: 0,
    airborne: false,
    expression: "idle",
    squash: 1,
    maxHeight: 0,
    groundY: 0,
  });
});

// Visual fixture: flung droplets render as instanced wet spheres in WebGL (so a splash throws
// visible goo). A handful of live droplets spread out FAR FROM THE BLOB (so they count as
// "free", not merged) must paint real pixels.
test("FreeDroplets renders flung droplets as instanced wet spheres", async () => {
  // Blob is far away so all droplets are beyond the merge distance (rendered as free).
  setBlobDiagnostics({
    position: [20, 20, 20],
    velocity: [0, 0, 0],
    speed: 0,
    airborne: true,
    expression: "idle",
    squash: 1,
    maxHeight: 20,
    groundY: 0,
  });
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
