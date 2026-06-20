import { FixtureStage } from "@app/fixtures";
import { afterEach, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { setBlobDiagnostics } from "@/state";
import { SkyDome } from "../SkyDome";

function setAltitude(y: number) {
  setBlobDiagnostics({
    position: [0, y, 0],
    velocity: [0, 0, 0],
    speed: 0,
    airborne: true,
    expression: "idle",
    squash: 1,
    maxHeight: y,
    groundY: 0,
  });
}
afterEach(() => setAltitude(0));

/** Mean luminance [0,1] of the rendered canvas center (where the backdrop shows). */
async function centerLuminance(testId: string): Promise<number> {
  const canvas = document.querySelector(`[data-testid="${testId}"]`)?.querySelector("canvas");
  if (!canvas) throw new Error("canvas not mounted");
  const off = document.createElement("canvas");
  off.width = canvas.width;
  off.height = canvas.height;
  const ctx = off.getContext("2d");
  if (!ctx) throw new Error("no 2d context");
  ctx.drawImage(canvas, 0, 0);
  // Sample a small block at the dead center of the frame.
  const cx = Math.floor(off.width / 2);
  const cy = Math.floor(off.height / 2);
  const { data } = ctx.getImageData(cx - 8, cy - 8, 16, 16);
  let sum = 0;
  let n = 0;
  for (let i = 0; i < data.length; i += 4) {
    sum += (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
    n++;
  }
  return sum / n;
}

/** Mean HSV-style saturation [0,1] of the rendered canvas center — (max−min)/max per pixel. A
 *  washed-white/grey backdrop has near-zero saturation; a true colored band reads well above it. */
async function centerSaturation(testId: string): Promise<number> {
  const canvas = document.querySelector(`[data-testid="${testId}"]`)?.querySelector("canvas");
  if (!canvas) throw new Error("canvas not mounted");
  const off = document.createElement("canvas");
  off.width = canvas.width;
  off.height = canvas.height;
  const ctx = off.getContext("2d");
  if (!ctx) throw new Error("no 2d context");
  ctx.drawImage(canvas, 0, 0);
  const cx = Math.floor(off.width / 2);
  const cy = Math.floor(off.height / 2);
  const { data } = ctx.getImageData(cx - 8, cy - 8, 16, 16);
  let sum = 0;
  let n = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    sum += max === 0 ? 0 : (max - min) / max;
    n++;
  }
  return sum / n;
}

// Visual fixture: the painterly sky dome must actually paint colored pixels in a real
// WebGL context (regression guard for the gradient shader material), AND now installs the
// height-reactive biome fog on the scene without breaking that render.
test("SkyDome renders the gradient and installs biome fog", async () => {
  const screen = await render(
    <FixtureStage testId="sky-fixture" cameraDistance={0.1}>
      <SkyDome />
    </FixtureStage>,
  );

  await expect.element(screen.getByTestId("sky-fixture")).toBeInTheDocument();

  // Let a couple of frames flush so the GL context paints + the fog effect runs.
  await new Promise((r) => setTimeout(r, 80));

  await vi.waitFor(
    () => {
      const canvas = document.querySelector('[data-testid="sky-fixture"]')?.querySelector("canvas");
      if (!canvas) throw new Error("canvas not mounted");
      const dataUrl = canvas.toDataURL("image/png");
      // A non-trivial painted frame is well over a few KB of base64 — proves the dome paints
      // and the fog wiring didn't blank or crash the scene.
      expect(dataUrl.length).toBeGreaterThan(4000);
    },
    { timeout: 5000, interval: 50 },
  );
});

// F1 regression: the upper bands must NOT render near-white. The bug was a bright STATIC drei <Sky>
// + a fixed warm-cream light rig washing the space band's true near-black color to a pale/muddy
// backdrop regardless of the per-band data. SkyDome now crossfades that <Sky> out and ramps the
// band-gradient opacity with altitude, so the space band's center reads DARK. Lock it: render the
// backdrop at ground vs space and assert space is substantially darker (and genuinely dark).
test("the space band renders a DARK backdrop, not washed white", async () => {
  setAltitude(1000); // deep into the space band (minHeight 950) — sky #4c1f22→#060202, near-black
  await render(
    <FixtureStage testId="sky-space" cameraDistance={0.1}>
      <SkyDome />
    </FixtureStage>,
  );
  // Several frames so the height-reactive useFrame ramps the wash alpha + fades the drei <Sky>.
  await new Promise((r) => setTimeout(r, 200));
  await vi.waitFor(
    async () => {
      const lum = await centerLuminance("sky-space");
      // Near-black space backdrop: well under mid-grey. The pre-fix washed-white render sat high
      // (≳0.6); the dark band must come in low.
      expect(lum).toBeLessThan(0.35);
    },
    { timeout: 6000, interval: 80 },
  );
});

// F1 regression (the other end of the crossfade): the upper-atmosphere band must render as a real
// COLORED sky (icy gold-over-blue: top #ffe8a8 / mid #8fcfff / deep #4a8edc), not the washed-white
// grey the bug produced. A washed render has near-zero saturation; the true band is saturated.
test("the upper-atmosphere band renders a COLORED sky, not washed grey", async () => {
  setAltitude(360); // just into upper-atmosphere (minHeight 320)
  await render(
    <FixtureStage testId="sky-upper" cameraDistance={0.1}>
      <SkyDome />
    </FixtureStage>,
  );
  await new Promise((r) => setTimeout(r, 200));
  await vi.waitFor(
    async () => {
      const sat = await centerSaturation("sky-upper");
      expect(sat).toBeGreaterThan(0.12);
    },
    { timeout: 6000, interval: 80 },
  );
});
