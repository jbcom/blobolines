import path from "node:path";
import react from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

// Real-Chromium visual/render + audio-graph tests. Fixture tests render R3F scenes
// in a headless WebGL context and capture screenshots for the visual catalog.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@app": path.resolve(__dirname, "./app"),
    },
  },
  optimizeDeps: {
    include: ["react", "react-dom", "three", "@react-three/fiber", "@react-three/drei"],
    exclude: ["koota", "koota/react"],
  },
  test: {
    globals: true,
    include: [
      "app/**/__tests__/**/*.{browser,fixture}.test.{ts,tsx}",
      "src/**/__tests__/**/*.{browser,fixture}.test.{ts,tsx}",
    ],
    fileParallelism: false,
    testTimeout: 30000,
    browser: {
      enabled: true,
      provider: playwright({
        launchOptions: {
          args: [
            "--enable-webgl",
            "--enable-unsafe-swiftshader",
            "--ignore-gpu-blocklist",
            "--use-gl=angle",
            "--use-angle=swiftshader-webgl",
          ],
        },
      }),
      instances: [
        {
          browser: "chromium",
          headless: true,
          viewport: { width: 414, height: 896 },
        },
      ],
      screenshotFailures: true,
    },
  },
});
