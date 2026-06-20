import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import type { Group } from "three";
import { getBlobDiagnostics, useWorldStore } from "@/state";

/**
 * Renders a low-poly treasure CHEST GLB beneath each rare treasure-tier crystal, so the jackpot
 * pickup reads as a prize, not just a bigger gem. CrystalField owns the treasure gem's glint +
 * collect celebration + magnet/score; this is purely the decorative chest underneath. Cheap: only
 * ~3% of crystals are treasure, and we only mount chests within a render window around the blob.
 * Reads treasure positions from the world store (static — the chest sits where the gem spawned).
 */
const url = `${import.meta.env.BASE_URL}assets/models/treasure.glb`;
const WINDOW = 80; // only show chests within ±WINDOW metres of the blob (bounded scene graph)
const MAX_CHESTS = 6; // a small pool — treasure is rare, so few are ever on-screen at once

function ChestModel() {
  const { scene } = useGLTF(url);
  const model = useMemo(() => scene.clone(true), [scene]);
  return <primitive object={model} scale={1.1} />;
}

export function TreasureChests() {
  const refs = useRef<(Group | null)[]>([]);

  useFrame((state) => {
    const h = getBlobDiagnostics().position[1];
    const t = state.clock.elapsedTime;
    const crystals = useWorldStore.getState().crystals;

    // Gather the nearest treasure crystals within the render window (bounded to MAX_CHESTS).
    let n = 0;
    for (let i = 0; i < crystals.length && n < MAX_CHESTS; i++) {
      const c = crystals[i];
      if (c.tier !== "treasure") continue;
      if (Math.abs(c.position[1] - h) > WINDOW) continue;
      const g = refs.current[n];
      if (g) {
        // Seat the chest just below the gem glint, bobbing + slowly turning to draw the eye.
        const bob = Math.sin(t * 1.3 + i) * 0.15;
        g.visible = true;
        g.position.set(c.position[0], c.position[1] - 0.55 + bob, c.position[2]);
        g.rotation.y = t * 0.5 + i;
      }
      n++;
    }
    // Hide any unused pool slots this frame.
    for (let k = n; k < MAX_CHESTS; k++) {
      const g = refs.current[k];
      if (g) g.visible = false;
    }
  });

  return (
    <>
      {Array.from({ length: MAX_CHESTS }, (_, k) => (
        <group
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed-size pool, index IS the identity
          key={k}
          ref={(g) => {
            refs.current[k] = g;
          }}
          visible={false}
        >
          <ChestModel />
        </group>
      ))}
    </>
  );
}

if (!import.meta.env.VITEST) {
  useGLTF.preload(url);
}
