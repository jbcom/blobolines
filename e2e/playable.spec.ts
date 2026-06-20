import { altitude, expect, launchUp, startRun, test } from "./fixtures";

/**
 * The "is it playable?" gate. Drives the real game through the dev test bridge: enters a
 * run (Rapier Physics must mount — the WASM-suspension regression), launches the blob, and
 * asserts the altimeter climbs off zero. If Physics suspends or the launch doesn't move the
 * body, this fails. The bridge calls the store directly (no synthetic clicks) so the gate is
 * robust under CI's software GL.
 */
test("blob launches and climbs — game is playable", async ({ page }) => {
  await page.goto("/?dev");

  await startRun(page);
  // Give Rapier's WASM a beat to init + the body to settle on the starter pad.
  await page.waitForTimeout(1500);

  // launchUp resolves once the blob has settled and the launch impulse is requested. The
  // altimeter climbing off zero proves the whole chain: Physics mounted (WASM init resolved),
  // the body simulates, the impulse applied, and the height readout updates.
  await launchUp(page);
  await expect.poll(() => altitude(page), { timeout: 10_000 }).toBeGreaterThan(0);
});
