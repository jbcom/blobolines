import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { Color, type PointLight } from "three";
import { comboHeat } from "@/sim/combo";
import { getBlobDiagnostics, useGameStore } from "@/state";
import { palette } from "@/styles/tokens";

/**
 * A point light that FOLLOWS the blob, tinted to its skin (and toward the combo-flame
 * hue as the streak heats up), pulsing brighter on impact. It throws the blob's color
 * onto nearby pads + goo so Blobby feels present in the gooey daytime palette. Driven off
 * the diagnostics bridge (no per-frame re-render).
 */
export function BlobFollowLight() {
  const lightRef = useRef<PointLight>(null);
  const skin = useGameStore((s) => s.progress.skin);
  const base = useMemo(() => new Color(), []);
  const flame = useMemo(() => new Color(palette.goo.flame), []);

  useFrame(() => {
    const l = lightRef.current;
    if (!l) return;
    const diag = getBlobDiagnostics();
    const [bx, by, bz] = diag.position;
    l.position.set(bx, by + 1.2, bz + 1.5);

    // Tint to the skin, warming toward flame with combo heat.
    const combo = useGameStore.getState().run.combo;
    const heat = comboHeat(combo, 2);
    base.set(palette.blob[skin]);
    base.lerp(flame, heat * 0.8);
    l.color.copy(base);

    // Brighter on impact (squash dips), so a landing flashes the world.
    const impact = 1 - diag.squash; // 0..~0.3
    l.intensity = 3 + impact * 14 + heat * 4;
  });

  return <pointLight ref={lightRef} distance={22} decay={1.6} intensity={3} />;
}
