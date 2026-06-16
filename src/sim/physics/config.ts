/**
 * Rapier physics configuration for Blobolines. Real engine (not a stopgap integrator):
 * @react-three/rapier drives the blob's motion, gravity, and trampoline collisions.
 * Tuned for the vertical launcher — strong-ish gravity so launches arc and fall back.
 */

/** World gravity (m/s²). Vertical climber; gravity pulls the blob back down. */
export const GRAVITY: [number, number, number] = [0, -22, 0];

/** Blob body tuning. CCD on prevents tunneling through pads at launch speed. */
export const BLOB = {
  radius: 0.85,
  restitution: 0.0, // bounce is driven by trampoline launch, not collider bounce
  friction: 0.2,
  linearDamping: 0.05,
  ccd: true,
} as const;

/** How long the blob may rest on a pad before it auto-launches (seconds). */
export const AUTO_LAUNCH_DELAY = 1.6;

/** Death threshold: fall this far below the lowest nearby platform → game over. */
export const DEATH_FALL_DISTANCE = 24;

/** Lateral world bounds (blob bounces off these). */
export const WORLD_BOUND_XZ = 35;
