import { useFrame } from "@react-three/fiber";
import { useCallback, useRef } from "react";
import { createRng, type Rng } from "@/core/math";
import type { Vec3 } from "@/core/types";
import {
  type Droplet,
  spawnLaunchBurst,
  spawnSplash,
  spawnTrailDroplet,
  stepDroplet,
} from "@/render/vfx";
import { GRAVITY } from "@/sim/physics";

/**
 * Droplet runtime — owns the live goo droplets flung on impact. PlayerBlob calls
 * `splash(origin, strength)` on a hard landing, `launchBurst(origin, charge)` on a pop,
 * and `trail(origin, dir, speed)` each frame while airborne (distance-throttled here so
 * the wet wake stays even regardless of frame rate). This steps all droplets under gravity
 * each frame and exposes `get()` for the GooField to read. A seeded RNG keeps everything
 * deterministic. Caps the pool so the metaball field + perf stay bounded.
 */
const MAX_DROPLETS = 40;
/** Emit one trail droplet roughly every this-many world units travelled. */
const TRAIL_SPACING = 0.9;

export function useDroplets(seed = 1): {
  splash: (origin: Vec3, strength: number) => void;
  launchBurst: (origin: Vec3, charge: number) => void;
  trail: (origin: Vec3, dir: Vec3, speed: number) => void;
  get: () => readonly Droplet[];
} {
  const droplets = useRef<Droplet[]>([]);
  const rng = useRef<Rng>(createRng(seed));
  /** Distance travelled since the last trail droplet was emitted. */
  const trailAccum = useRef(0);
  const lastTrailPos = useRef<Vec3 | null>(null);

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

  const push = useCallback((d: Droplet) => {
    const list = droplets.current;
    // Evict the oldest when full so fresh goo always shows during a hard streak.
    if (list.length >= MAX_DROPLETS) list.shift();
    list.push(d);
  }, []);

  const splash = useCallback(
    (origin: Vec3, strength: number) => {
      for (const d of spawnSplash(origin, strength, rng.current)) push(d);
    },
    [push],
  );

  const launchBurst = useCallback(
    (origin: Vec3, charge: number) => {
      for (const d of spawnLaunchBurst(origin, charge, rng.current)) push(d);
    },
    [push],
  );

  const trail = useCallback(
    (origin: Vec3, dir: Vec3, speed: number) => {
      const last = lastTrailPos.current;
      if (last) {
        trailAccum.current += Math.hypot(
          origin[0] - last[0],
          origin[1] - last[1],
          origin[2] - last[2],
        );
      }
      lastTrailPos.current = [origin[0], origin[1], origin[2]];
      if (trailAccum.current < TRAIL_SPACING) return;
      trailAccum.current = 0;
      push(spawnTrailDroplet(origin, dir, speed, rng.current));
    },
    [push],
  );

  const get = useCallback(() => droplets.current, []);

  return { splash, launchBurst, trail, get };
}
