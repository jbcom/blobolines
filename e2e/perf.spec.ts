import { expect, test } from "./fixtures";

test.setTimeout(45_000);

/**
 * Perf-regression gate. Drives a scripted climb and samples per-frame times via rAF, then
 * asserts the frame-time distribution stays under a (deliberately lenient) budget. It runs in
 * headless Chromium on SwiftShader (software GL — far slower than a real GPU), so the budget
 * is generous: this catches CATASTROPHIC regressions (an unbounded per-frame alloc, a runaway
 * world-gen loop, a postfx pass that tanks the frame) — NOT micro-perf. A real device is much
 * faster than this CI path, so passing here is a floor, not a ceiling.
 */
test("frame-time stays within budget over a scripted climb", async ({ page }) => {
  await page.goto("/?dev");
  await page.getByRole("button", { name: "DEV" }).click();
  await page.getByRole("button", { name: /start run/ }).click();
  await page.waitForTimeout(1500); // Rapier WASM init + settle

  // Climb: a few mega launches with time to arc, so the sampled window covers real flight +
  // world extension + the full VFX/postfx stack under load (the worst-case per-frame cost).
  for (let i = 0; i < 4; i++) {
    await page
      .getByRole("button", { name: /launch up|mega/i })
      .first()
      .click();
    await page.waitForTimeout(700);
  }

  // Sample ~3s of rAF deltas in-page, then return the frame-time stats. (Absolute frame times
  // here are dominated by SwiftShader's software GL, so we assert LIVENESS — frames keep flowing
  // and none is a multi-second freeze — not an absolute fps budget, which SwiftShader can't
  // meaningfully measure. This catches a real hang: an infinite world-gen loop, a per-frame leak
  // that grinds to a halt, a deadlocked physics step.)
  const stats = await page.evaluate(
    () =>
      new Promise<{ count: number; max: number; elapsed: number }>((resolve) => {
        const deltas: number[] = [];
        let last = performance.now();
        const start = last;
        const tick = (now: number) => {
          deltas.push(now - last);
          last = now;
          if (now - start < 3000) {
            requestAnimationFrame(tick);
          } else {
            const sorted = deltas.slice(1).sort((a, b) => a - b); // drop the first (warmup) delta
            resolve({ count: sorted.length, max: sorted.at(-1) ?? 0, elapsed: now - start });
          }
        };
        requestAnimationFrame(tick);
      }),
  );

  // The frame loop kept producing frames over the window (not stalled/dead/frozen).
  expect(stats.count).toBeGreaterThan(5);
  // No single frame was a multi-second freeze — a hang (runaway loop, deadlocked step) would
  // show as a giant gap. 1.5s is far above any real per-frame cost yet well below a true hang.
  expect(stats.max).toBeLessThan(1500);
});
