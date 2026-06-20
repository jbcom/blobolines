import { expect, startRun, teleport, test } from "./fixtures";

/**
 * The dev teleport jumps the Rapier body to a target altitude (DevHarness / test bridge), used to
 * QA each biome band across the full climb. It snaps the body onto the nearest existing pad
 * at-or-below the target, so a teleport — even a SEQUENCE of them across bands — leaves the blob
 * resting up-band rather than free-falling into a padless gap and dying (the bug this guards).
 * It also proves each band's scenery/parallax/particles mount + simulate without crashing.
 */
test("sequential teleports land the blob up in each biome band without dying", async ({ page }) => {
  await page.goto("/?dev");
  await startRun(page);
  await page.waitForTimeout(1500); // Rapier WASM init + settle on the starter pad
  // Read the BODY altitude (diagnostics position.y via the bridge), not the HUD altimeter (which
  // shows run.height, the climb score — the teleport intentionally doesn't inflate it).
  const bodyY = () => page.evaluate(() => window.__blobtest.altitude());

  // Launch once first so the blob is definitively airborne + the climb is established before we
  // teleport — teleporting straight off a still-settling starter pad races the body's initial
  // physics and can occasionally no-op the first jump under slow CI.
  await page.evaluate(() => window.__blobtest.launchUp());
  await expect.poll(bodyY, { timeout: 12_000, intervals: [500] }).toBeGreaterThan(5);

  // Teleport UP into a band, then BACK DOWN to a lower one — the descending teleport is the
  // regression case (ensureHeight is monotonic, so the lower target adds no new pads; the
  // snap-to-nearest-pad must still rest the body up-tower instead of collapsing to the ~1m starter
  // and dying). Poll with a WIDE interval so the teleport+snap+diagnostics has time to apply under
  // slow software-GL CI without flooding the budget with evaluate round-trips.
  await teleport(page, 600);
  await expect.poll(bodyY, { timeout: 12_000, intervals: [600] }).toBeGreaterThan(30);
  await teleport(page, 200);
  // The bug collapsed this repeat teleport to the starter region (~1m); landing up-tower proves
  // the snap-to-pad fix holds and the page kept simulating through the band changes.
  await expect.poll(bodyY, { timeout: 12_000, intervals: [600] }).toBeGreaterThan(30);
});
