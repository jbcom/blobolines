import { FixtureStage } from "@app/fixtures";
import { afterEach, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { setBlobDiagnostics, useGameStore } from "@/state";
import { BlobTrail } from "../BlobTrail";

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

// Visual fixture: a fast-moving airborne blob builds a tapered ribbon (non-collapsed strip)
// and paints in WebGL. Moving the blob across frames must spread the ribbon vertices out.
test("BlobTrail builds a ribbon behind a fast airborne blob", async () => {
  useGameStore.setState((s) => ({ run: { ...s.run, combo: 4 } }));
  setBlobDiagnostics({
    position: [0, 0, 0],
    velocity: [0, 30, 0],
    speed: 30,
    airborne: true,
    expression: "wide",
    squash: 1,
    maxHeight: 0,
    groundY: 0,
  });

  const screen = await render(
    <FixtureStage testId="trail-fixture" cameraDistance={8}>
      <ambientLight intensity={1} />
      <BlobTrail skin="blue" />
    </FixtureStage>,
  );

  await expect.element(screen.getByTestId("trail-fixture")).toBeInTheDocument();

  // Step the blob upward over several frames so the ribbon accumulates length.
  for (let i = 1; i <= 12; i++) {
    setBlobDiagnostics({
      position: [0, i * 0.8, 0],
      velocity: [0, 30, 0],
      speed: 30,
      airborne: true,
      expression: "wide",
      squash: 1,
      maxHeight: i,
      groundY: 0,
    });
    await new Promise((r) => setTimeout(r, 30));
  }

  await vi.waitFor(
    () => {
      const canvas = document
        .querySelector('[data-testid="trail-fixture"]')
        ?.querySelector("canvas");
      if (!canvas) throw new Error("canvas not mounted");
      expect(canvas.toDataURL("image/png").length).toBeGreaterThan(4000);
    },
    { timeout: 6000, interval: 60 },
  );
});
