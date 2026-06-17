import { FixtureStage } from "@app/fixtures";
import { afterEach, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { setQualityPref } from "@/render/qualityBridge";
import { PostFX } from "../PostFX";

afterEach(() => setQualityPref("auto"));

// The EffectComposer is fragile (it crashes on a ref'd effect / circular JSON). These guard
// that the tier-gated effect array renders a non-empty composer in BOTH the full (high) and the
// stripped (low: no bloom, no chromatic, no AO/DOF) configurations, in a real WebGL context.
async function expectComposerPaints(testId: string) {
  await render(
    <FixtureStage testId={testId} cameraDistance={4}>
      {/* A bright emissive mesh so there's something for the grade/bloom to act on. */}
      <mesh>
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={2} />
      </mesh>
      <PostFX playing />
    </FixtureStage>,
  );
  await new Promise((r) => setTimeout(r, 150));
  await vi.waitFor(
    () => {
      const canvas = document.querySelector(`[data-testid="${testId}"]`)?.querySelector("canvas");
      if (!canvas) throw new Error("canvas not mounted");
      expect(canvas.toDataURL("image/png").length).toBeGreaterThan(4000);
    },
    { timeout: 6000, interval: 60 },
  );
}

test("PostFX renders the full effect stack at HIGH tier", async () => {
  setQualityPref("high");
  await expectComposerPaints("postfx-high");
});

test("PostFX renders with bloom + chromatic + AO stripped at LOW tier", async () => {
  setQualityPref("low");
  await expectComposerPaints("postfx-low");
});
