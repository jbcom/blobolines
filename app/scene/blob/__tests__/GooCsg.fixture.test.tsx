import { FixtureStage } from "@app/fixtures";
import { expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import type { Droplet } from "@/render/vfx";
import { setBlobDiagnostics } from "@/state";
import { GooCsg } from "../GooCsg";

// Visual fixture: the CSG goo body must paint real pixels in a WebGL context AND survive
// the droplet-union chain without erroring (regression guard for the three-bvh-csg
// boundsTree-reuse bug + frustum culling of the per-frame-swapped geometry).
test("GooCsg renders the merged goo body (with nearby droplets) in WebGL", async () => {
  setBlobDiagnostics({
    position: [0, 0, 0],
    velocity: [0, 6, 0],
    speed: 6,
    airborne: true,
    expression: "idle",
    squash: 1,
    maxHeight: 0,
    groundY: 0,
  });
  // Two droplets overlapping the blob so the union chain actually runs (exercises the
  // result-as-input reuse path that previously threw `bvhcast of null`).
  const droplets: Droplet[] = [
    { position: [0.5, 0.2, 0], velocity: [0, 0, 0], radius: 0.4, age: 0, life: 1 },
    { position: [-0.4, 0.3, 0.2], velocity: [0, 0, 0], radius: 0.35, age: 0, life: 1 },
  ];

  const screen = await render(
    <FixtureStage testId="goocsg-fixture" cameraDistance={5}>
      <ambientLight intensity={1} />
      <GooCsg skin="blue" blobRadius={0.85} getDroplets={() => droplets} />
    </FixtureStage>,
  );

  await expect.element(screen.getByTestId("goocsg-fixture")).toBeInTheDocument();
  await new Promise((r) => setTimeout(r, 120));

  await vi.waitFor(
    () => {
      const canvas = document
        .querySelector('[data-testid="goocsg-fixture"]')
        ?.querySelector("canvas");
      if (!canvas) throw new Error("canvas not mounted");
      const dataUrl = canvas.toDataURL("image/png");
      expect(dataUrl.length).toBeGreaterThan(4000);
    },
    { timeout: 6000, interval: 60 },
  );
});

// Settled/resting goo exercises the myriad-deform path: wet SAG eases in + the asymmetric
// LOBE grows when grounded + slow, so the body must still paint a real (non-sphere) goo
// silhouette without erroring on the new vertex displacement modes.
test("GooCsg renders a settled, sagging+lobed goo puddle at rest", async () => {
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

  const screen = await render(
    <FixtureStage testId="goocsg-rest-fixture" cameraDistance={5}>
      <ambientLight intensity={1} />
      <GooCsg skin="slime" blobRadius={0.85} getDroplets={() => []} />
    </FixtureStage>,
  );

  await expect.element(screen.getByTestId("goocsg-rest-fixture")).toBeInTheDocument();
  // Let the sprung sag/lobe ease in over a few frames before sampling.
  await new Promise((r) => setTimeout(r, 200));

  await vi.waitFor(
    () => {
      const canvas = document
        .querySelector('[data-testid="goocsg-rest-fixture"]')
        ?.querySelector("canvas");
      if (!canvas) throw new Error("canvas not mounted");
      expect(canvas.toDataURL("image/png").length).toBeGreaterThan(4000);
    },
    { timeout: 6000, interval: 60 },
  );
});
