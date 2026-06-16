import { FixtureStage } from "@app/fixtures";
import { expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import type { Droplet } from "@/render/vfx";
import { setBlobDiagnostics } from "@/state";
import { GooField } from "../GooField";

// Visual fixture: the raymarched metaball goo skin must paint pixels when the blob +
// nearby droplets are present (regression guard for the metaball shader + uniforms).
test("GooField renders the merged metaball goo", async () => {
  setBlobDiagnostics({
    position: [0, 0, 0],
    velocity: [0, 0, 0],
    speed: 0,
    airborne: false,
    expression: "idle",
    squash: 1,
    maxHeight: 0,
  });
  const droplets: Droplet[] = [
    { position: [1, 0.5, 0], velocity: [0, 0, 0], radius: 0.4, age: 0, life: 1 },
    { position: [-0.8, 0.6, 0.3], velocity: [0, 0, 0], radius: 0.3, age: 0, life: 1 },
  ];

  const screen = await render(
    <FixtureStage testId="goo-fixture" cameraDistance={5}>
      <GooField skin="blue" blobRadius={0.85} getDroplets={() => droplets} />
    </FixtureStage>,
  );

  await expect.element(screen.getByTestId("goo-fixture")).toBeInTheDocument();
  await new Promise((r) => setTimeout(r, 120));

  await vi.waitFor(
    () => {
      const canvas = document.querySelector('[data-testid="goo-fixture"]')?.querySelector("canvas");
      if (!canvas) throw new Error("canvas not mounted");
      expect(canvas.toDataURL("image/png").length).toBeGreaterThan(4000);
    },
    { timeout: 5000, interval: 50 },
  );
});
