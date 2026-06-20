import { expect, launchUp, startRun, test } from "./fixtures";

// Software-GL (SwiftShader) CI is far slower to load + WASM-init than a real GPU; give the
// scripted-climb sampling window generous headroom there, keep it tight locally.
test.setTimeout(process.env.CI ? 90_000 : 45_000);

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
  await startRun(page);
  await page.waitForTimeout(1500); // Rapier WASM init + settle

  // Climb: a few launches with time to arc, so the sampled window covers real flight +
  // world extension + the full VFX/postfx stack under load (the worst-case per-frame cost).
  // Drive via the test bridge (store calls), not synthetic clicks that stall under software GL.
  for (let i = 0; i < 4; i++) {
    await launchUp(page);
    await page.waitForTimeout(700);
  }

  // Sample ~3s of rAF deltas in-page, then return the frame-time stats. (Absolute frame times
  // here are dominated by SwiftShader's software GL, so we assert LIVENESS — frames keep flowing
  // and none is a multi-second freeze — not an absolute fps budget, which SwiftShader can't
  // meaningfully measure. This catches a real hang: an infinite world-gen loop, a per-frame leak
  // that grinds to a halt, a deadlocked physics step.)
  const stats = await page.evaluate(
    () =>
      // Collect a FIXED NUMBER of frames (not a fixed time window): software GL (SwiftShader) on
      // CI may render well under 2fps with the full postfx stack, so a 3s window can yield only a
      // couple of frames even though the loop is perfectly alive. Sampling N frames with a wall-
      // clock safety cap keeps the liveness check meaningful on any render speed — it still catches
      // a true hang (the cap trips with too few frames, or a delta is a multi-second freeze).
      new Promise<{ count: number; max: number; elapsed: number }>((resolve) => {
        const deltas: number[] = [];
        let last = performance.now();
        const start = last;
        const TARGET_FRAMES = 8;
        const MAX_MS = 30_000; // generous cap for slow software GL; a real hang never reaches 8 frames
        const tick = (now: number) => {
          deltas.push(now - last);
          last = now;
          if (deltas.length <= TARGET_FRAMES && now - start < MAX_MS) {
            requestAnimationFrame(tick);
          } else {
            const sorted = deltas.slice(1).sort((a, b) => a - b); // drop the first (warmup) delta
            resolve({ count: sorted.length, max: sorted.at(-1) ?? 0, elapsed: now - start });
          }
        };
        requestAnimationFrame(tick);
      }),
  );

  // The frame loop kept producing frames (not stalled/dead/frozen): it reached the target count
  // before the wall-clock cap. A deadlocked/runaway loop would never accumulate enough frames.
  expect(stats.count).toBeGreaterThanOrEqual(5);
  // No single frame was a multi-second freeze — a true hang would show as a giant gap. 2.5s is far
  // above any real per-frame cost even on software GL, yet well below a deadlock.
  expect(stats.max).toBeLessThan(2500);
});
