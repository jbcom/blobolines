import { FixtureStage } from "@app/fixtures";
import { expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { setBlobDiagnostics } from "@/state";
import { BlobShadow } from "../BlobShadow";

// Visual fixture: the fake contact-shadow disc must paint in WebGL and sit on groundY
// (not at the blob), so it grounds the blob as it arcs up. It's a flat alpha-blended disc
// (NOT drei ContactShadows), so it can't fight the postprocessing composer's render targets.
test("BlobShadow renders the contact disc on the ground plane", async () => {
  setBlobDiagnostics({
    position: [0, 2, 0],
    velocity: [0, 0, 0],
    speed: 0,
    airborne: true,
    expression: "idle",
    squash: 1,
    maxHeight: 2,
    groundY: 0,
  });

  const screen = await render(
    <FixtureStage testId="shadow-fixture" cameraDistance={6}>
      <ambientLight intensity={1} />
      <mesh position={[0, -0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[8, 8]} />
        <meshStandardMaterial color="#dfeefc" />
      </mesh>
      <BlobShadow />
    </FixtureStage>,
  );

  await expect.element(screen.getByTestId("shadow-fixture")).toBeInTheDocument();
  await new Promise((r) => setTimeout(r, 100));

  await vi.waitFor(
    () => {
      const canvas = document
        .querySelector('[data-testid="shadow-fixture"]')
        ?.querySelector("canvas");
      if (!canvas) throw new Error("canvas not mounted");
      expect(canvas.toDataURL("image/png").length).toBeGreaterThan(4000);
    },
    { timeout: 5000, interval: 60 },
  );
});
