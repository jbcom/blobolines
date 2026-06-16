import { useFrame } from "@react-three/fiber";
import { useCallback, useRef } from "react";
import { createRng, type Rng } from "@/core/math";
import type { Vec3 } from "@/core/types";
import { type Droplet, spawnSplash, stepDroplet } from "@/render/vfx";
import { GRAVITY } from "@/sim/physics";

/**
 * Droplet runtime — owns the live goo droplets flung on impact. PlayerBlob calls
 * `splash(origin, strength)` on a hard landing; this steps all droplets under gravity
 * each frame and exposes `get()` for the GooField to read. A seeded RNG keeps splashes
 * deterministic. Caps the pool so the metaball field + perf stay bounded.
 */
const MAX_DROPLETS = 40;

export function useDroplets(seed = 1): {
  splash: (origin: Vec3, strength: number) => void;
  get: () => readonly Droplet[];
} {
  const droplets = useRef<Droplet[]>([]);
  const rng = useRef<Rng>(createRng(seed));

  useFrame((_, dt) => {
    const list = droplets.current;
    if (list.length === 0) return;
    const step = Math.min(dt, 1 / 30);
    let w = 0;
    for (let i = 0; i < list.length; i++) {
      const next = stepDroplet(list[i], step, GRAVITY[1]);
      if (next) list[w++] = next;
    }
    list.length = w;
  });

  const splash = useCallback((origin: Vec3, strength: number) => {
    const burst = spawnSplash(origin, strength, rng.current);
    const list = droplets.current;
    for (const d of burst) {
      if (list.length >= MAX_DROPLETS) break;
      list.push(d);
    }
  }, []);

  const get = useCallback(() => droplets.current, []);

  return { splash, get };
}
