import { Canvas } from "@react-three/fiber";
import { GameScene } from "./scene/GameScene";
import { HudOverlay } from "./views/HudOverlay";

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
        gl={{ antialias: true, powerPreference: "high-performance" }}
        camera={{ position: [0, 6, 12], fov: 60, near: 0.1, far: 200 }}
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
