import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { capturePlugin } from "./scripts/capturePlugin";

const isCapacitor = process.env.CAPACITOR === "true";
const isPages = process.env.GITHUB_PAGES === "true";

const resolveBase = () => {
  if (isCapacitor) return "./"; // native packages load assets relatively
  if (isPages) return "/blobolines/"; // GitHub Pages project site
  return "/";
};

export default defineConfig({
  plugins: [react(), tailwindcss(), capturePlugin()],
  base: resolveBase(),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@app": path.resolve(__dirname, "./app"),
    },
    // three-bvh-csg attaches a BVH (geometry.boundsTree) and the Evaluator reads it back;
    // if three resolves to two module instances, the BVH is written on one BufferGeometry
    // prototype and read on the other → `Cannot read properties of null (reading 'bvhcast')`
    // every frame. Force a single three instance so the BVH round-trips correctly.
    dedupe: ["three"],
  },
  server: { port: 5173, host: true },
  preview: { port: 5173 },
  // Rapier ships WASM; pre-bundling it breaks the async init (Physics suspends
  // forever). Excluding it is the canonical fix (matches arcade-cabinet/will-it-blow).
  optimizeDeps: {
    exclude: ["@react-three/rapier", "@dimforge/rapier3d-compat"],
    // Pre-bundle the CSG goo libs together with three so they share the SAME optimized
    // three instance (see resolve.dedupe) — otherwise the BVH attach/read split breaks.
    include: ["three", "three-bvh-csg", "three-mesh-bvh"],
  },
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
            // Keep rapier + rapier3d-compat in the SAME chunk as three/fiber so the
            // WASM relative-URL module graph stays intact (splitting it 404s the .wasm
            // in the production build and Physics suspends forever). Matches will-it-blow.
            if (
              /[\\/](three|@react-three[\\/](fiber|drei|rapier)|@dimforge[\\/]rapier3d-compat)[\\/]/.test(
                id,
              )
            )
              return "three";
            if (/[\\/](@react-three[\\/]postprocessing|postprocessing)[\\/]/.test(id))
              return "postprocessing";
            if (/[\\/]howler[\\/]/.test(id)) return "audio";
            if (/[\\/](react|react-dom|zod|motion)[\\/]/.test(id)) return "vendor";
          }
          return undefined;
        },
      },
    },
  },
  assetsInclude: ["**/*.glb", "**/*.gltf", "**/*.hdr"],
});
