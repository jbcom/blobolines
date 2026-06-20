import { test as base, expect } from "@playwright/test";

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
