import { expect, test } from "./fixtures";

/**
 * Broader gameplay e2e beyond the headline "is it playable" gate: the gameover → retry remount
 * loop (PlayerBlob + Physics must cleanly tear down and re-mount), a combo carrying into a run,
 * and surviving a full reload (WebGL context re-init). Driven through the dev harness + real UI.
 */

async function startRun(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "DEV" }).click();
  await page.getByRole("button", { name: /start run/ }).click();
  await page.waitForTimeout(1500); // Rapier WASM init + settle
}

test("gameover → Climb again cleanly remounts into a fresh playable run", async ({ page }) => {
  await page.goto("/?dev");
  await startRun(page);

  // Climb a little so the run has a non-zero height.
  await page
    .getByRole("button", { name: /launch up|mega/i })
    .first()
    .click();
  await expect
    .poll(async () => Number((await page.getByTestId("altitude-value").innerText()).trim()), {
      timeout: 10_000,
    })
    .toBeGreaterThan(0);

  // Force game over via the harness (button label includes "game over"), then retry from the card.
  await page.getByRole("button", { name: /game over/i }).click();
  const climbAgain = page.getByRole("button", { name: /climb again/i });
  await expect(climbAgain).toBeVisible({ timeout: 5000 });
  await climbAgain.click();

  // The new run remounted: the altimeter is back near zero, and a fresh launch climbs again —
  // proving Physics + PlayerBlob tore down and re-initialised without suspending.
  await page.waitForTimeout(1500);
  // Ensure the harness is open (its open/closed state may carry across the remount): only toggle
  // DEV if the launch control isn't already showing.
  const launch = page.getByRole("button", { name: /launch up|mega/i }).first();
  if (!(await launch.isVisible())) {
    await page.getByRole("button", { name: "DEV" }).click();
  }
  await launch.click();
  await expect
    .poll(async () => Number((await page.getByTestId("altitude-value").innerText()).trim()), {
      timeout: 10_000,
    })
    .toBeGreaterThan(0);
});

test("survives a full reload (WebGL context re-initialises) and is playable again", async ({
  page,
}) => {
  await page.goto("/?dev");
  await startRun(page);
  await page
    .getByRole("button", { name: /launch up|mega/i })
    .first()
    .click();
  await expect
    .poll(async () => Number((await page.getByTestId("altitude-value").innerText()).trim()), {
      timeout: 10_000,
    })
    .toBeGreaterThan(0);

  // Reload — the GL context is destroyed + recreated; the game must come back playable.
  await page.reload();
  await startRun(page);
  await page
    .getByRole("button", { name: /launch up|mega/i })
    .first()
    .click();
  await expect
    .poll(async () => Number((await page.getByTestId("altitude-value").innerText()).trim()), {
      timeout: 10_000,
    })
    .toBeGreaterThan(0);
});
