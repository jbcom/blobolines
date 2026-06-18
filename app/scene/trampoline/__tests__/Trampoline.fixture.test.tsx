import { FixtureStage } from "@app/fixtures";
import { Physics } from "@react-three/rapier";
import { expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { Trampoline } from "../Trampoline";

// Visual fixture: a cloud pad (lumpy goo-cloud body + splat decal plane) renders painted pixels
// in a real WebGL context. Regression guard that the GooMaterial cloud body and CanvasTexture
// decal compile and draw.
test("Trampoline compatibility component renders a cloud pad with its splat surface", async () => {
  const screen = await render(
    <FixtureStage testId="tramp-fixture" cameraDistance={10}>
      <Physics paused gravity={[0, -22, 0]}>
        <Trampoline id={0} position={[0, 0, 0]} width={6} depth={6} type="standard" />
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

// A canted cloud (angled route cue that redirects the catch laterally) compiles + draws.
test("canted Trampoline compatibility component renders its angled cloud", async () => {
  const screen = await render(
    <FixtureStage testId="canted-fixture" cameraDistance={10}>
      <Physics paused gravity={[0, -22, 0]}>
        <Trampoline id={0} position={[0, 0, 0]} width={6} depth={6} type="canted" cant={[1, 0]} />
      </Physics>
    </FixtureStage>,
  );

  await expect.element(screen.getByTestId("canted-fixture")).toBeInTheDocument();
  await new Promise((r) => setTimeout(r, 100));

  await vi.waitFor(
    () => {
      const canvas = document
        .querySelector('[data-testid="canted-fixture"]')
        ?.querySelector("canvas");
      if (!canvas) throw new Error("canvas not mounted");
      expect(canvas.toDataURL("image/png").length).toBeGreaterThan(4000);
    },
    { timeout: 8000, interval: 100 },
  );
});
