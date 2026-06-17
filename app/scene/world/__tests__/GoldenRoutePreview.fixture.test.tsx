import { FixtureStage } from "@app/fixtures";
import { afterEach, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { setRouteProofTarget } from "@/state";
import { GoldenRoutePreview } from "../GoldenRoutePreview";

afterEach(() => setRouteProofTarget(null));

test("GoldenRoutePreview renders the certified route proof in WebGL", async () => {
  setRouteProofTarget({ pairIndex: 0 });

  const screen = await render(
    <FixtureStage testId="golden-route-fixture" cameraDistance={16}>
      <group position={[0, -4, 0]}>
        <GoldenRoutePreview />
      </group>
    </FixtureStage>,
  );

  await expect.element(screen.getByTestId("golden-route-fixture")).toBeInTheDocument();
  await new Promise((r) => setTimeout(r, 120));

  await vi.waitFor(
    () => {
      const canvas = document
        .querySelector('[data-testid="golden-route-fixture"]')
        ?.querySelector("canvas");
      if (!canvas) throw new Error("canvas not mounted");
      expect(canvas.toDataURL("image/png").length).toBeGreaterThan(4000);
    },
    { timeout: 6000, interval: 60 },
  );
});
