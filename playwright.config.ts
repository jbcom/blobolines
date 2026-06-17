import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright e2e — drives the real game in a real browser against the Vite dev server
 * (so the dev harness + capture middleware are live). The headline spec proves the game
 * is PLAYABLE end-to-end: Rapier Physics mounts, the blob launches and climbs.
 */
export default defineConfig({
  testDir: "./e2e",
  // These are GPU-backed WebGL gameplay checks against one Vite server and one capture
  // middleware. Running multiple Chromium/SwiftShader contexts at once makes the dev harness
  // click targets intermittently unstable, so keep the playable gate serial and deterministic.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
    // WebGL needs a GPU path in headless Chromium.
    launchOptions: {
      args: [
        "--enable-webgl",
        "--enable-unsafe-swiftshader",
        "--ignore-gpu-blocklist",
        "--use-gl=angle",
        "--use-angle=swiftshader-webgl",
      ],
    },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
