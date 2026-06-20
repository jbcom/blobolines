import { expect, test } from "./fixtures";

/**
 * The "is it playable?" gate. Drives the real game through the dev harness: enters a
 * run (Rapier Physics must mount — the WASM-suspension regression), launches the blob,
 * and asserts the altimeter climbs off zero. If Physics suspends or the launch doesn't
 * move the body, this fails.
 */
test("blob launches and climbs — game is playable", async ({ page }) => {
  await page.goto("/?dev");

  // Open the dev harness and start a run.
  await page.getByRole("button", { name: "DEV" }).click();
  await page.getByRole("button", { name: /start run/ }).click();

  // Give Rapier's WASM a beat to init + the body to settle on the starter pad.
  await page.waitForTimeout(1500);

  // Launch and confirm the altimeter climbs off zero. This single assertion proves the
  // whole chain works: Physics mounted (WASM init resolved — the regression), the body
  // simulates, the launch impulse applied, and the height-chase readout updates.
  await page.getByRole("button", { name: /launch up/ }).click();
  await expect
    .poll(async () => Number((await page.getByTestId("altitude-value").innerText()).trim()), {
      timeout: 10_000,
    })
    .toBeGreaterThan(0);
});
