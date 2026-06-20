import { altitude, expect, gameOver, launchUp, startRun, test } from "./fixtures";

/**
 * Broader gameplay e2e beyond the headline "is it playable" gate: the gameover → retry remount
 * loop (PlayerBlob + Physics must cleanly tear down and re-mount) and surviving a full reload
 * (WebGL context re-init). Start/launch/gameover are driven via the dev test bridge (store calls,
 * robust under software GL); the "Climb again" retry is a real GameOver-card UI click — that
 * button is part of the shipped game, so exercising it as a real click is the point of the test.
 */

test("gameover → Climb again cleanly remounts into a fresh playable run", async ({ page }) => {
  await page.goto("/?dev");
  await startRun(page);
  await page.waitForTimeout(1500); // Rapier WASM init + settle

  // Climb a little so the run has a non-zero height.
  await launchUp(page);
  await expect.poll(() => altitude(page), { timeout: 10_000 }).toBeGreaterThan(0);

  // Force game over via the bridge, then retry from the real GameOver card.
  await gameOver(page);
  const climbAgain = page.getByRole("button", { name: /climb again/i });
  await expect(climbAgain).toBeVisible({ timeout: 5000 });
  await climbAgain.click();

  // The new run remounted: a fresh launch climbs again — proving Physics + PlayerBlob tore down
  // and re-initialised without suspending.
  await startRun(page);
  await page.waitForTimeout(1500);
  await launchUp(page);
  await expect.poll(() => altitude(page), { timeout: 10_000 }).toBeGreaterThan(0);
});

test("survives a full reload (WebGL context re-initialises) and is playable again", async ({
  page,
}) => {
  await page.goto("/?dev");
  await startRun(page);
  await page.waitForTimeout(1500);
  await launchUp(page);
  await expect.poll(() => altitude(page), { timeout: 10_000 }).toBeGreaterThan(0);

  // Reload — the GL context is destroyed + recreated; the game must come back playable.
  await page.reload();
  await startRun(page);
  await page.waitForTimeout(1500);
  await launchUp(page);
  await expect.poll(() => altitude(page), { timeout: 10_000 }).toBeGreaterThan(0);
});
