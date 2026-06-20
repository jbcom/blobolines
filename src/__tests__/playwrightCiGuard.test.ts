import { describe, expect, it } from "vitest";
// Vite ?raw import: the playwright config file's source as a string, no node builtins needed
// and no @playwright/test runtime pulled into happy-dom.
import config from "../../playwright.config.ts?raw";

/**
 * CI OOM-guard regression test. GitHub Actions gives headless Chromium a 64MB /dev/shm; under
 * SwiftShader the WebGL render targets + preserveDrawingBuffer backbuffer + the dev harness's
 * canvas.toDataURL readbacks route through it and OOM-kill the renderer mid-E2E (page closes →
 * every spec cascades to timeout). `--disable-dev-shm-usage` routes Chromium shmem to disk-backed
 * /tmp instead, which is what keeps the renderer alive. This guards the flag against accidental
 * removal.
 */
describe("playwright CI launch args", () => {
  it("routes Chromium shared memory off the 64MB /dev/shm so the renderer is not OOM-killed", () => {
    expect(config).toContain("--disable-dev-shm-usage");
  });

  it("keeps the SwiftShader software-GL path so WebGL works without a real GPU in CI", () => {
    expect(config).toContain("--enable-unsafe-swiftshader");
    expect(config).toContain("--use-angle=swiftshader-webgl");
  });
});
