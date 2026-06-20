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

  // Teleport up through the bands then BACK DOWN — the descending targets are the regression case
  // (ensureHeight is monotonic, so a lower target adds no new pads; the snap-to-nearest-pad must
  // still rest the body well up the tower instead of collapsing it to the ~1m starter and dying).
  for (const target of [320, 600, 320, 120]) {
    await teleport(page, target);
    // The body rests on the nearest existing pad at-or-below the target — well above the ~1m
    // starter. The bug this guards collapsed every repeat teleport to the starter region (~1m)
    // after a death; staying above 30m proves it landed up-tower on a real pad instead. (We don't
    // assert the exact band: a descending teleport lands on whatever pad already exists below the
    // lower target, which can be sparse — exact-band landing is a separate refinement.)
    await expect.poll(bodyY, { timeout: 8000 }).toBeGreaterThan(30);
  }

  // The page is still alive + simulating after teleporting through every band (no crash, the
  // diagnostics keep updating) — the whole point of the QA tool.
  expect(await bodyY()).toBeGreaterThan(30);
});
