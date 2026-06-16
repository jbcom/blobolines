import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const isCapacitor = process.env.CAPACITOR === "true";
const isPages = process.env.GITHUB_PAGES === "true";

const resolveBase = () => {
  if (isCapacitor) return "./"; // native packages load assets relatively
  if (isPages) return "/blobolines/"; // GitHub Pages project site
  return "/";
};

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: resolveBase(),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@app": path.resolve(__dirname, "./app"),
    },
  },
  server: { port: 5173, host: true },
  preview: { port: 5173 },
  build: {
    outDir: "dist",
    sourcemap: true,
    target: "es2022",
    chunkSizeWarningLimit: 3000,
    rollupOptions: {
      output: {
        // rolldown (Vite 8) requires manualChunks as a function, not an object.
        manualChunks(id: string) {
          if (id.includes("node_modules")) {
            if (/[\\/](three|@react-three[\\/]fiber|@react-three[\\/]drei)[\\/]/.test(id))
              return "three";
            if (/[\\/](@react-three[\\/]rapier|@dimforge[\\/]rapier3d-compat)[\\/]/.test(id))
              return "rapier";
            if (/[\\/](@react-three[\\/]postprocessing|postprocessing|n8ao)[\\/]/.test(id))
              return "postprocessing";
            if (/[\\/]tone[\\/]/.test(id)) return "audio";
            if (/[\\/](react|react-dom|koota|zod|motion)[\\/]/.test(id)) return "vendor";
          }
          return undefined;
        },
      },
    },
  },
  assetsInclude: ["**/*.glb", "**/*.gltf", "**/*.hdr"],
});
