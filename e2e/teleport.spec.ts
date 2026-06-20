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

/**
 * Regression: second consecutive teleport to a HIGHER band from a resting body dies.
 *
 * Root cause: TrampolineField drives its mount window from React state (setCenterY).
 * When the body teleports 290+ world units upward, React commits the new window 1–2
 * frames later — during which the body free-falls with no cloud sensor present.
 * DEATH_FALL_DISTANCE = 24 m, gravity = -22 m/s², so the body dies within ~1.5 s.
 *
 * Fix: PlayerBlob.useFrame seeds a `teleportAnchor` on every cloud-pad teleport and
 * injects a synthetic reportCloudAdherence() each frame until a real Trampoline sensor
 * takes over. This keeps the soft-settle force active throughout the mount gap.
 */
test("second teleport from resting body to higher band survives and stays playing", async ({
  page,
}) => {
  await page.goto("/?dev");
  await startRun(page);
  await page.waitForTimeout(1500);

  const bodyY = () => page.evaluate(() => window.__blobtest.altitude());
  const phase = () => page.evaluate(() => window.__blobtest.phase());

  // Establish the blob airborne before the first teleport.
  await page.evaluate(() => window.__blobtest.launchUp());
  await expect.poll(bodyY, { timeout: 12_000, intervals: [500] }).toBeGreaterThan(5);

  // First teleport — lands at ~340.
  await teleport(page, 340);
  await expect.poll(bodyY, { timeout: 12_000, intervals: [600] }).toBeGreaterThan(300);

  // Let the body fully settle on the cloud pad (1400 ms).
  await page.waitForTimeout(1400);

  // Second teleport to a much higher band — this is the regression case.
  // The TrampolineField window lags 1–2 render cycles before the new Trampoline mounts;
  // the teleport anchor must bridge that gap so the body doesn't free-fall and die.
  await teleport(page, 640);

  // After 900 ms the anchor has long handed off to the real sensor. Assert alive + up-band.
  await page.waitForTimeout(900);
  expect(await phase()).toBe("playing");
  expect(await bodyY()).toBeGreaterThan(560);
});
