import { FixtureStage } from "@app/fixtures";
import { afterEach, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { isPowerupActive, resetPowerups, setBlobDiagnostics, useWorldStore } from "@/state";
import { PowerUpField } from "../PowerUpField";

afterEach(() => {
  useWorldStore.setState({ powerups: [] });
  resetPowerups();
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

// Slow-mo is a model-less power-up: it renders its shared primitive (the violet "time
// crystal" octahedron) directly — no GLB, no Suspense swap — so the field must paint pixels
// for it the same as for the GLB-backed magnet/thruster.
test("PowerUpField renders the model-less slow-mo gem", async () => {
  useWorldStore.setState({ powerups: [{ position: [0, 0, 0], type: "slowmo" }] });
  setBlobDiagnostics({
    position: [3, 0, 0],
    velocity: [0, 0, 0],
    speed: 0,
    airborne: true,
    expression: "idle",
    squash: 1,
    maxHeight: 0,
    groundY: 0,
  });

  const screen = await render(
    <FixtureStage testId="slowmo-fixture" cameraDistance={5}>
      <ambientLight intensity={1} />
      <PowerUpField />
    </FixtureStage>,
  );

  await expect.element(screen.getByTestId("slowmo-fixture")).toBeInTheDocument();
  await new Promise((r) => setTimeout(r, 150));

  await vi.waitFor(
    () => {
      const canvas = document
        .querySelector('[data-testid="slowmo-fixture"]')
        ?.querySelector("canvas");
      if (!canvas) throw new Error("canvas not mounted");
      expect(canvas.toDataURL("image/png").length).toBeGreaterThan(4000);
    },
    { timeout: 6000, interval: 60 },
  );
});

// Score-doubler is also model-less: its shared primitive is the gold "value gem"
// (dodecahedron). Same render guarantee as the other power-ups.
test("PowerUpField renders the model-less score-doubler gem", async () => {
  useWorldStore.setState({ powerups: [{ position: [0, 0, 0], type: "doubler" }] });
  setBlobDiagnostics({
    position: [3, 0, 0],
    velocity: [0, 0, 0],
    speed: 0,
    airborne: true,
    expression: "idle",
    squash: 1,
    maxHeight: 0,
    groundY: 0,
  });

  const screen = await render(
    <FixtureStage testId="doubler-fixture" cameraDistance={5}>
      <ambientLight intensity={1} />
      <PowerUpField />
    </FixtureStage>,
  );

  await expect.element(screen.getByTestId("doubler-fixture")).toBeInTheDocument();
  await new Promise((r) => setTimeout(r, 150));

  await vi.waitFor(
    () => {
      const canvas = document
        .querySelector('[data-testid="doubler-fixture"]')
        ?.querySelector("canvas");
      if (!canvas) throw new Error("canvas not mounted");
      expect(canvas.toDataURL("image/png").length).toBeGreaterThan(4000);
    },
    { timeout: 6000, interval: 60 },
  );
});

// Multi-bounce is model-less too: its shared primitive is the green springy tetrahedron.
test("PowerUpField renders the model-less multi-bounce gem", async () => {
  useWorldStore.setState({ powerups: [{ position: [0, 0, 0], type: "multibounce" }] });
  setBlobDiagnostics({
    position: [3, 0, 0],
    velocity: [0, 0, 0],
    speed: 0,
    airborne: true,
    expression: "idle",
    squash: 1,
    maxHeight: 0,
    groundY: 0,
  });

  const screen = await render(
    <FixtureStage testId="multibounce-fixture" cameraDistance={5}>
      <ambientLight intensity={1} />
      <PowerUpField />
    </FixtureStage>,
  );

  await expect.element(screen.getByTestId("multibounce-fixture")).toBeInTheDocument();
  await new Promise((r) => setTimeout(r, 150));

  await vi.waitFor(
    () => {
      const canvas = document
        .querySelector('[data-testid="multibounce-fixture"]')
        ?.querySelector("canvas");
      if (!canvas) throw new Error("canvas not mounted");
      expect(canvas.toDataURL("image/png").length).toBeGreaterThan(4000);
    },
    { timeout: 6000, interval: 60 },
  );
});

// The live-index frame loop must still COLLECT: with the blob sitting on a power-up, the
// pickup test fires (activatePowerup), so the buff turns active. Guards the perf refactor that
// switched from iterating every child to iterating only the live-index list.
test("PowerUpField collects a power-up the blob is sitting on", async () => {
  useWorldStore.setState({ powerups: [{ position: [0, 0, 0], type: "magnet" }] });
  setBlobDiagnostics({
    position: [0, 0, 0], // dead on the power-up → inside the pickup radius
    velocity: [0, 0, 0],
    speed: 0,
    airborne: true,
    expression: "idle",
    squash: 1,
    maxHeight: 0,
    groundY: 0,
  });

  await render(
    <FixtureStage testId="collect-fixture" cameraDistance={5}>
      <ambientLight intensity={1} />
      <PowerUpField />
    </FixtureStage>,
  );

  await vi.waitFor(() => expect(isPowerupActive("magnet")).toBe(true), {
    timeout: 6000,
    interval: 60,
  });
});
