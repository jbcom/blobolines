import { FixtureStage } from "@app/fixtures";
import { afterEach, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { reportBlobSplit, resetBridges } from "@/state";
import { SplitBlobEchoes } from "../SplitBlobEchoes";

afterEach(() => {
  resetBridges();
});

test("SplitBlobEchoes renders visible split Blobby fragments", async () => {
  reportBlobSplit({
    position: [0, 0, 0],
    velocity: [1, 7, 0],
    normal: [0, 0, 1],
    count: 5,
    spread: 2.8,
    strength: 0.9,
  });

  const screen = await render(
    <FixtureStage testId="split-echo-fixture" cameraDistance={5}>
      <ambientLight intensity={1} />
      <SplitBlobEchoes skin="blue" />
    </FixtureStage>,
  );

  await expect.element(screen.getByTestId("split-echo-fixture")).toBeInTheDocument();
  await vi.waitFor(
    () => {
      const canvas = document
        .querySelector('[data-testid="split-echo-fixture"]')
        ?.querySelector("canvas");
      if (!canvas) throw new Error("canvas not mounted");
      expect(canvas.toDataURL("image/png").length).toBeGreaterThan(4000);
    },
    { timeout: 6000, interval: 60 },
  );
});
