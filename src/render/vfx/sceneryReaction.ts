import type { Vec3 } from "@/core/types";

/**
 * Blob-reactive scenery (pure). The near parallax props are normally inert decoration — this
 * computes how one prop should react as the blob rushes past it: a normalized influence that
 * falls off with distance and scales with the blob's speed, a lean angle (the prop tips AWAY
 * from the blob, as if shoved by the rush of air), and a small scale-pop (a flyby acknowledgement).
 *
 * Pure + deterministic: a function only of the blob's world position/velocity and the prop's
 * world position — no three objects, no clock, no RNG. The caller eases the live transform toward
 * these targets each frame (so the prop springs back when the blob leaves). Far/mid layers don't
 * call this — only the near layer, which sits close enough to the playfield to read as reactive.
 */

export interface SceneryReactionConfig {
  /** Radius (world units) within which the blob influences a prop; 0 influence at/beyond it. */
  radius: number;
  /** Blob speed (world units/s) at which the shove reaches full strength; clamped to 1 above. */
  fullSpeed: number;
  /** Max lean angle (radians) at full influence — how far the prop tips away from the blob. */
  maxLean: number;
  /** Max scale-pop (fraction, e.g. 0.12 = +12%) at full influence. */
  maxPop: number;
}

export const DEFAULT_SCENERY_REACTION: SceneryReactionConfig = {
  radius: 7,
  fullSpeed: 26,
  maxLean: 0.32,
  maxPop: 0.12,
};

export interface SceneryReaction {
  /** 0..1 — how strongly the blob is affecting this prop right now (distance × speed). */
  influence: number;
  /** Target lean about Z (radians). Sign tips the prop AWAY from the blob horizontally. */
  lean: number;
  /** Target additive scale fraction (0 = rest, maxPop at full influence). */
  pop: number;
}

const REST: SceneryReaction = { influence: 0, lean: 0, pop: 0 };

/**
 * Compute the reaction target for a prop given the blob's current world position + velocity.
 * Distance uses the X/Y plane (depth Z is the parallax axis, not part of the "near miss" feel).
 */
export function sceneryReaction(
  blobPos: Vec3,
  blobVel: Vec3,
  propPos: Vec3,
  cfg: SceneryReactionConfig = DEFAULT_SCENERY_REACTION,
): SceneryReaction {
  const dx = propPos[0] - blobPos[0];
  const dy = propPos[1] - blobPos[1];
  const dist = Math.hypot(dx, dy);
  if (dist >= cfg.radius) return REST;

  // Proximity falloff: 1 at the blob, 0 at the radius edge (linear — cheap + legible).
  const proximity = 1 - dist / cfg.radius;
  // Speed scale: a fast flyby shoves hard, a slow drift-by barely stirs the prop.
  const speed = Math.hypot(blobVel[0], blobVel[1], blobVel[2]);
  const speedScale = Math.min(1, speed / cfg.fullSpeed);
  const influence = proximity * speedScale;

  // Lean AWAY from the blob on the X axis. A prop to the blob's RIGHT (dx > 0) should tip further
  // right — and in three.js a positive rotation.z is COUNTER-clockwise (tips the top LEFT), so a
  // rightward tip is a NEGATIVE z rotation. Hence the leading minus. Guard the dead-centre case.
  const dir = dx === 0 ? 0 : Math.sign(dx);
  // `|| 0` normalizes the -0 that `-dir * … * 0` yields at zero influence to a clean +0.
  const lean = -dir * cfg.maxLean * influence || 0;
  const pop = cfg.maxPop * influence;
  return { influence, lean, pop };
}
