import { FixtureStage } from "@app/fixtures";
import { afterEach, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { setBlobDiagnostics } from "@/state";
import { BlobActor } from "../BlobActor";

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

// Visual fixture: the gooey blob (goo shader + procedural eyes) renders painted pixels
// in a real WebGL context — regression guard for the material + eye geometry.
test("BlobActor renders the gooey blob with eyes", async () => {
  const screen = await render(
    <FixtureStage testId="blob-fixture" cameraDistance={3}>
      <BlobActor skin="blue" expression="wide" />
    </FixtureStage>,
  );

  await expect.element(screen.getByTestId("blob-fixture")).toBeInTheDocument();
  await new Promise((r) => setTimeout(r, 100));

  await vi.waitFor(
    () => {
      // Scope to THIS fixture's canvas (not the first global one) to avoid cross-test flake.
      const canvas = document
        .querySelector('[data-testid="blob-fixture"]')
        ?.querySelector("canvas");
      if (!canvas) throw new Error("canvas not mounted");
      expect(canvas.toDataURL("image/png").length).toBeGreaterThan(4000);
    },
    { timeout: 5000, interval: 50 },
  );
});

// Visual fixture: a hard impact drives the surface-tension wobble (uWobble vertex
// displacement). The wobbled blob must still paint pixels — regression guard that the
// displaced-vertex + recomputed-normal path compiles and renders in a real WebGL context.
test("BlobActor renders with impact wobble", async () => {
  const screen = await render(
    <FixtureStage testId="blob-wobble-fixture" cameraDistance={3}>
      <BlobActor skin="slime" expression="squint" impact={1} velocity={[0, -12, 0]} />
    </FixtureStage>,
  );

  await expect.element(screen.getByTestId("blob-wobble-fixture")).toBeInTheDocument();
  await new Promise((r) => setTimeout(r, 100));

  await vi.waitFor(
    () => {
      const canvas = document
        .querySelector('[data-testid="blob-wobble-fixture"]')
        ?.querySelector("canvas");
      if (!canvas) throw new Error("canvas not mounted");
      expect(canvas.toDataURL("image/png").length).toBeGreaterThan(4000);
    },
    { timeout: 5000, interval: 50 },
  );
});

// Visual fixture: the title/menu hero must not sit as a static circle. Its idle CSG body
// cycles between a flattened happy puddle and a taller perky blob; the canvas frame should
// visibly change over the loop even without impact or player input.
test("BlobActor hero idle visibly burbles over time", async () => {
  const screen = await render(
    <FixtureStage testId="blob-hero-idle-fixture" cameraDistance={3}>
      <BlobActor skin="slime" expression="idle" />
    </FixtureStage>,
  );

  await expect.element(screen.getByTestId("blob-hero-idle-fixture")).toBeInTheDocument();
  await new Promise((r) => setTimeout(r, 180));

  const canvas = document
    .querySelector('[data-testid="blob-hero-idle-fixture"]')
    ?.querySelector("canvas");
  if (!canvas) throw new Error("canvas not mounted");
  const firstFrame = canvas.toDataURL("image/png");

  await new Promise((r) => setTimeout(r, 760));
  const laterFrame = canvas.toDataURL("image/png");

  expect(laterFrame).not.toBe(firstFrame);
});

// Visual fixture: the LIVE eyes (reading the diagnostics bridge) animate over several frames —
// blink/pupil-dart/tear all driven off the once-bucketed lid/pupil/tear node arrays (the perf
// ref-cache replacing the per-frame traverse). Guards that the cached-node animation loop still
// paints a live, tearing blob face without erroring.
test("BlobActor renders live animating eyes (ref-cached, tearing)", async () => {
  // A fast downward fall → the eye model tears; live velocity drives the pupil dart.
  setBlobDiagnostics({
    position: [0, 0, 0],
    velocity: [3, -14, 0],
    speed: 14,
    airborne: true,
    expression: "tear",
    squash: 1,
    maxHeight: 50,
    groundY: 50,
  });

  const screen = await render(
    <FixtureStage testId="blob-eyes-fixture" cameraDistance={3}>
      <BlobActor skin="blue" expression="tear" live velocity={[3, -14, 0]} />
    </FixtureStage>,
  );

  await expect.element(screen.getByTestId("blob-eyes-fixture")).toBeInTheDocument();
  // Several frames so the once-mount bucketing runs and the loop animates the cached nodes.
  await new Promise((r) => setTimeout(r, 200));

  await vi.waitFor(
    () => {
      const canvas = document
        .querySelector('[data-testid="blob-eyes-fixture"]')
        ?.querySelector("canvas");
      if (!canvas) throw new Error("canvas not mounted");
      expect(canvas.toDataURL("image/png").length).toBeGreaterThan(4000);
    },
    { timeout: 5000, interval: 50 },
  );
});
