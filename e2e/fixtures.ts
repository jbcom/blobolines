import { test as base, expect, type Page } from "@playwright/test";

declare global {
  interface Window {
    __blobtest: {
      startRun(): void;
      launchUp(): Promise<void>;
      gameOver(): void;
      altitude(): number;
      phase(): string;
      teleport(y: number): void;
    };
  }
}

/**
 * Drive the game through the dev-only window.__blobtest bridge (store/launch-bridge calls)
 * instead of synthetic clicks on DevHarness buttons. Synthetic pointer events on a GPU-saturated
 * main thread stall indefinitely under CI's SwiftShader software GL; calling the store directly
 * via page.evaluate sidesteps that entirely. Waits for the bridge to be installed first.
 */
export async function startRun(page: Page): Promise<void> {
  await page.waitForFunction(() => "__blobtest" in window);
  await page.evaluate(() => window.__blobtest.startRun());
}

export async function launchUp(page: Page): Promise<void> {
  await page.evaluate(() => window.__blobtest.launchUp());
}

export async function gameOver(page: Page): Promise<void> {
  await page.evaluate(() => window.__blobtest.gameOver());
}

export async function teleport(page: Page, y: number): Promise<void> {
  await page.evaluate((target) => window.__blobtest.teleport(target), y);
}

/** Poll the altimeter HUD readout (the same value a player sees). */
export async function altitude(page: Page): Promise<number> {
  return Number((await page.getByTestId("altitude-value").innerText()).trim());
}

/**
 * Shared E2E fixture that surfaces WHY a page dies. The CI failure mode is "Target page,
 * context or browser has been closed" with no visible cause — these listeners print the
 * page console, uncaught page errors, WebGL/renderer crashes, and the moment the context
 * closes to the Playwright stdout (which IS captured in the CI job log), so a failing run
 * tells us the crash reason instead of only a downstream timeout.
 */
export const test = base.extend({
  page: async ({ page }, use, testInfo) => {
    const tag = `[${testInfo.title}]`;
    page.on("console", (msg) => {
      // Only surface warnings/errors to keep the log focused on failure signal.
      const type = msg.type();
      if (type === "error" || type === "warning") {
        console.log(`${tag} console.${type}: ${msg.text()}`);
      }
    });
    page.on("pageerror", (err) => {
      console.log(`${tag} PAGEERROR: ${err.message}\n${err.stack ?? ""}`);
    });
    page.on("crash", () => {
      console.log(`${tag} PAGE CRASHED (renderer process gone — OOM or GL crash)`);
    });
    page.on("close", () => {
      console.log(`${tag} page closed`);
    });
    await use(page);
  },
});

export { expect };
