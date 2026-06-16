import type { RootState } from "@react-three/fiber";
import { Canvas } from "@react-three/fiber";
import { GameScene } from "./scene/GameScene";
import { HudOverlay } from "./views/HudOverlay";

/**
 * WebGL context-loss handling. Mobile GPUs can drop the rendering context (backgrounding,
 * memory pressure); without this the canvas goes permanently blank. preventDefault on
 * `lost` tells the browser we'll recover, and three re-initializes on `restored`.
 */
function handleCanvasCreated(state: RootState) {
  const canvas = state.gl.domElement;
  canvas.addEventListener(
    "webglcontextlost",
    (e) => {
      e.preventDefault();
      console.warn("[Blobolines] WebGL context lost — awaiting restore.");
    },
    false,
  );
  canvas.addEventListener(
    "webglcontextrestored",
    () => console.warn("[Blobolines] WebGL context restored."),
    false,
  );
}

/**
 * Top-level layout: the R3F <Canvas> fills the screen at z-canvas; the DOM UI
 * overlay (shadcn-based HUD/menus) is positioned absolutely above it. UI never
 * touches three objects directly — it talks to the game through the store/bridge.
 */
export function Game() {
  return (
    <div className="relative h-full w-full overflow-hidden">
      <Canvas
        className="absolute inset-0"
        dpr={[1, 2]}
        gl={{
          antialias: true,
          powerPreference: "high-performance",
          // preserveDrawingBuffer is only needed so the dev harness can read the canvas
          // via toDataURL(); it carries a real mobile perf cost, so keep it OUT of prod.
          preserveDrawingBuffer: import.meta.env.DEV,
        }}
        camera={{ position: [0, 6, 12], fov: 60, near: 0.1, far: 200 }}
        onCreated={handleCanvasCreated}
        // The 3D scene conveys nothing actionable a screen reader can't get from the DOM
        // HUD; hide it so AT users don't hit an empty, unlabeled focus stop / "graphic".
        aria-hidden
        tabIndex={-1}
      >
        <GameScene />
      </Canvas>

      <div
        className="pointer-events-none absolute inset-0"
        style={{ zIndex: "var(--z-hud)" as unknown as number }}
      >
        <HudOverlay />
      </div>
    </div>
  );
}
