import type { Entity, World } from "koota";
import { Blob, Transform, Velocity } from "@/ecs";

/**
 * Spawns the player-blob entity into the ECS world with its starting traits. The blob's
 * DYNAMICS stay owned by Rapier (the rigid body); this entity is the blob's logical
 * source of truth — position/velocity/squash/expression — that sim systems and UI can
 * query without reaching into the renderer. A per-frame sync writes the live Rapier-driven
 * diagnostics into these traits (see syncBlobEntity).
 *
 * Factories own spawning (per docs/ARCHITECTURE.md) — never call world.spawn(Blob, …)
 * directly from a component.
 */
export function spawnBlob(world: World, radius: number): Entity {
  return world.spawn(
    Transform({ x: 0, y: 3, z: 0 }),
    Velocity({ x: 0, y: 0, z: 0 }),
    Blob({ radius, squash: 1, airborne: true, expression: "idle" }),
  );
}
