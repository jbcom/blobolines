import { Lighting, SkyDome } from "./world";

/**
 * Root scene composition inside <Canvas>. Composes small, single-responsibility
 * scene layers (per docs/ARCHITECTURE.md) — never a monolith. Gameplay layers
 * (blob, trampolines, vfx, postfx) are added as their packages land.
 */
export function GameScene() {
  return (
    <>
      <SkyDome />
      <Lighting />
    </>
  );
}
