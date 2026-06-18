import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Fast unit/integration tests in happy-dom. Pure sim, engine, factories, hooks, utils.
// Visual/render and audio-graph tests live in vitest.browser.config.ts (real Chromium).
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@app": path.resolve(__dirname, "./app"),
    },
    dedupe: ["three"],
  },
  test: {
    globals: true,
    environment: "happy-dom",
    setupFiles: ["./src/__tests__/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}", "app/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules", "e2e", "**/*.browser.test.{ts,tsx}", "**/*.fixture.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary", "html"],
      reportsDirectory: "./coverage",
      include: [
        "src/core/**/*.ts",
        "src/sim/**/*.ts",
        "src/engine/**/*.ts",
        "src/systems/**/*.ts",
        "src/lib/**/*.ts",
      ],
    },
  },
});
