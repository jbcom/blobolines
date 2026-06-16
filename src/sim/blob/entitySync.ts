import type { EyeExpression, Vec3 } from "@/core/types";

/**
 * Pure mapping from a blob diagnostics snapshot (Rapier-driven) to the ECS Blob/Transform/
 * Velocity trait values. Kept pure so it's unit-testable and DOM-free; the system that owns
 * the entity (syncBlobEntity) applies the result with entity.set(). Rapier remains the
 * dynamics authority; this projects its state onto the queryable ECS source of truth.
 */
export interface BlobSnapshot {
  position: Vec3;
  velocity: Vec3;
  squash: number;
  airborne: boolean;
  expression: EyeExpression;
}

export interface BlobTraitUpdate {
  transform: { x: number; y: number; z: number };
  velocity: { x: number; y: number; z: number };
  blob: { squash: number; airborne: boolean; expression: EyeExpression };
}

export function blobTraitsFromSnapshot(s: BlobSnapshot): BlobTraitUpdate {
  return {
    transform: { x: s.position[0], y: s.position[1], z: s.position[2] },
    velocity: { x: s.velocity[0], y: s.velocity[1], z: s.velocity[2] },
    blob: { squash: s.squash, airborne: s.airborne, expression: s.expression },
  };
}
