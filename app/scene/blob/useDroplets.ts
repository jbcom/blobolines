import { useGameLoop } from "@app/hooks/useGameLoop";
import { useCallback, useRef } from "react";
import { createRng, type Rng } from "@/core/math";
import type { Vec3 } from "@/core/types";
import {
  type Droplet,
  spawnLaunchBurst,
  spawnNudgeBurst,
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
 * each frame and exposes `get()` for GooCsg/FreeDroplets to read. A seeded RNG keeps
 * everything deterministic. Caps the pool so the CSG merge work + free-droplet draw stay bounded.
 */
const MAX_DROPLETS = 40;
/** Emit one trail droplet roughly every this-many world units travelled. */
const TRAIL_SPACING = 0.9;

export function useDroplets(seed = 1): {
  splash: (origin: Vec3, strength: number) => void;
  launchBurst: (origin: Vec3, charge: number) => void;
  nudgeBurst: (origin: Vec3, nudgeDir: readonly [number, number, number]) => void;
  trail: (origin: Vec3, dir: Vec3, speed: number) => void;
  reset: () => void;
  get: () => readonly Droplet[];
} {
  const droplets = useRef<Droplet[]>([]);
  const rng = useRef<Rng>(createRng(seed));
  /** Distance travelled since the last trail droplet was emitted. */
  const trailAccum = useRef(0);
  const lastTrailPos = useRef<Vec3 | null>(null);
  /** Write cursor for the ring buffer (overwrites oldest when full — O(1), no shift). */
  const head = useRef(0);

  // Step droplets on the engine's fixed timestep (deterministic + frame-rate-independent)
  // rather than a per-render dt clamp — the documented engine.tick seam.
  useGameLoop((dt) => {
    const list = droplets.current;
    if (list.length === 0) return;
    let w = 0;
    for (let i = 0; i < list.length; i++) {
      const next = stepDroplet(list[i], dt, GRAVITY[1]);
      if (next) list[w++] = next;
    }
    list.length = w;
    // Compaction shifted survivors to the front; if we dropped below capacity the ring
    // cursor is stale, so reset it to overwrite from the true oldest when next full.
    if (w < MAX_DROPLETS) head.current = 0;
  });

  const push = useCallback((d: Droplet) => {
    const list = droplets.current;
    if (list.length < MAX_DROPLETS) {
      list.push(d);
    } else {
      // Full: overwrite the oldest in place (ring buffer) so fresh goo always shows
      // during a hard streak without an O(n) Array.shift each emission.
      list[head.current] = d;
      head.current = (head.current + 1) % MAX_DROPLETS;
    }
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

  const nudgeBurst = useCallback(
    (origin: Vec3, nudgeDir: readonly [number, number, number]) => {
      for (const d of spawnNudgeBurst(origin, nudgeDir, rng.current)) push(d);
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

  const reset = useCallback(() => {
    droplets.current.length = 0;
    head.current = 0;
    trailAccum.current = 0;
    lastTrailPos.current = null;
  }, []);

  const get = useCallback(() => droplets.current, []);

  return { splash, launchBurst, nudgeBurst, trail, reset, get };
}
