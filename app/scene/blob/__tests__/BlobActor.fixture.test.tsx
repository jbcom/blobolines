import { FixtureStage } from "@app/fixtures";
import { expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { BlobActor } from "../BlobActor";

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
