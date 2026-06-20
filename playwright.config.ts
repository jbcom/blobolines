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
        // GitHub Actions gives Chromium a 64MB /dev/shm. Under SwiftShader every WebGL
        // surface + the EffectComposer's full-screen render targets + the preserveDrawingBuffer
        // backbuffer + the dev harness's repeated canvas.toDataURL readbacks are CPU-backed and
        // route through that shared memory. The 64MB ceiling OOM-kills the renderer mid-test
        // (page closes → every E2E cascades to timeout). Route Chromium shmem to disk-backed
        // /tmp (the runner has GBs) so the renderer survives the full climb + captures.
        "--disable-dev-shm-usage",
        "--disable-gpu-sandbox",
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
