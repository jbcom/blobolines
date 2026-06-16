import { useGameStore } from "@/state";
import { BlobActor } from "./blob";
import { Lighting, SkyDome } from "./world";

/**
 * Root scene composition inside <Canvas>. Composes small, single-responsibility
 * scene layers (per docs/ARCHITECTURE.md) — never a monolith. Gameplay layers
 * (trampolines, vfx, postfx) are added as their packages land.
 */
export function GameScene() {
  const skin = useGameStore((s) => s.progress.skin);

  return (
    <>
      <SkyDome />
      <Lighting />
      <BlobActor skin={skin} />
    </>
  );
}
