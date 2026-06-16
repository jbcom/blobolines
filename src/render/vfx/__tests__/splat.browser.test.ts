import { expect, test } from "vitest";
import { createSplatCanvas } from "../splat";

// Canvas2D is only real in the browser env (happy-dom has no 2D context), so the splat
// painter is tested here: it must paint actual non-transparent pixels.
test("splat painter paints goo pixels onto the canvas", () => {
  const s = createSplatCanvas(128);
  s.paint(0.5, 0.5, "#2e8bf0", 0.25);

  const { data } = s.ctx.getImageData(0, 0, 128, 128);
  let painted = 0;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] > 0) painted++; // non-zero alpha
  }
  expect(painted).toBeGreaterThan(50);
});

test("fade reduces painted alpha", () => {
  const s = createSplatCanvas(64);
  s.paint(0.5, 0.5, "#7ed957", 0.4);
  const before = totalAlpha(s.ctx.getImageData(0, 0, 64, 64).data);
  s.fade(0.5);
  const after = totalAlpha(s.ctx.getImageData(0, 0, 64, 64).data);
  expect(after).toBeLessThan(before);
});

function totalAlpha(data: Uint8ClampedArray): number {
  let sum = 0;
  for (let i = 3; i < data.length; i += 4) sum += data[i];
  return sum;
}
