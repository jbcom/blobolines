import { FixtureStage } from "@app/fixtures";
import { Physics } from "@react-three/rapier";
import { afterEach, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { consumeObstacleBounce, setBlobDiagnostics, useWorldStore } from "@/state";
import { ObstacleField } from "../ObstacleField";

function setBlob(position: [number, number, number], speed: number) {
  setBlobDiagnostics({
    position,
    velocity: [speed, 0, 0],
    speed,
    airborne: true,
    expression: "idle",
    squash: 1,
    maxHeight: position[1],
    groundY: 0,
  });
}

afterEach(() => {
  useWorldStore.setState({ obstacles: [], seed: 1, seedPhrase: "seed-1", runId: 0 });
  setBlob([0, 0, 0], 0);
  consumeObstacleBounce(); // drain any pending event between tests
});

// Visual + behavioural fixture: an off-route obstacle renders a solid icosahedron in WebGL, and a
// FAST blob entering its contact shell fires the bounce feedback (the actual rebound is Rapier's;
// this asserts the cosmetic/feedback trigger). A SLOW brush must NOT fire (slow brushes stay quiet).
test("ObstacleField renders an obstacle and fires a bounce on a fast contact", async () => {
  useWorldStore.setState({ obstacles: [{ id: 0, position: [0, 0, 0], radius: 2 }] });
  // Blob arriving fast, inside the contact shell (radius 2 + ~1 pad).
  setBlob([1.5, 0, 0], 20);

  await render(
    <FixtureStage testId="obstacle-fixture" cameraDistance={10}>
      <Physics gravity={[0, 0, 0]} paused>
        <ObstacleField />
      </Physics>
    </FixtureStage>,
  );

  await vi.waitFor(
    () => {
      const canvas = document
        .querySelector('[data-testid="obstacle-fixture"]')
        ?.querySelector("canvas");
      if (!canvas) throw new Error("canvas not mounted");
      expect(canvas.toDataURL("image/png").length).toBeGreaterThan(4000); // obstacle painted
      // The fast contact reported a bounce event.
      const ev = consumeObstacleBounce();
      expect(ev, "a fast contact must report a bounce").toBeTruthy();
      expect(ev?.speed).toBeGreaterThanOrEqual(6);
    },
    { timeout: 6000, interval: 80 },
  );
});

test("a SLOW brush does not fire a bounce", async () => {
  useWorldStore.setState({ obstacles: [{ id: 0, position: [0, 0, 0], radius: 2 }] });
  setBlob([1.5, 0, 0], 1); // inside the shell but barely moving

  await render(
    <FixtureStage testId="obstacle-slow" cameraDistance={10}>
      <Physics gravity={[0, 0, 0]} paused>
        <ObstacleField />
      </Physics>
    </FixtureStage>,
  );

  // Give several frames a chance to (wrongly) fire.
  await new Promise((r) => setTimeout(r, 250));
  expect(consumeObstacleBounce(), "a slow brush must stay silent").toBeNull();
});

test("a fast blob LINGERING inside the shell fires the bounce ONCE, not every PULSE_LIFE", async () => {
  useWorldStore.setState({ obstacles: [{ id: 0, position: [0, 0, 0], radius: 2 }] });
  setBlob([1.5, 0, 0], 20); // fast + inside the shell, and it stays there (no movement out)

  await render(
    <FixtureStage testId="obstacle-linger" cameraDistance={10}>
      <Physics gravity={[0, 0, 0]} paused>
        <ObstacleField />
      </Physics>
    </FixtureStage>,
  );

  // Wait well past PULSE_LIFE (0.32s) so a re-triggering bug would fire a SECOND bounce.
  await new Promise((r) => setTimeout(r, 600));
  // Exactly one bounce should have been reported the whole time the blob lingered: drain it once,
  // then confirm no further bounce was queued (the latch only re-arms when the blob LEAVES the shell).
  const first = consumeObstacleBounce();
  expect(first, "the entry must fire one bounce").toBeTruthy();
  await new Promise((r) => setTimeout(r, 400)); // another PULSE_LIFE+ while still lingering
  expect(
    consumeObstacleBounce(),
    "lingering inside the shell must NOT re-fire the bounce",
  ).toBeNull();
});
