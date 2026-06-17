/**
 * Rapier physics configuration for Blobolines. Real engine (not a stopgap integrator):
 * @react-three/rapier drives the blob's motion, gravity, and trampoline collisions.
 *
 * Values are data-driven from src/config/physics.json (see src/config) so balancing is
 * editable as data and modifiers can scale these bases. These named exports keep the
 * existing call sites unchanged.
 */
import { physics } from "@/config";

/** World gravity (m/s²). Vertical climber; gravity pulls the blob back down. */
export const GRAVITY: [number, number, number] = physics.gravity;

/** Blob body tuning. CCD on prevents tunneling through pads at launch speed. */
export const BLOB = physics.blob;

/** Blob center Y when resting on the starter pad surface. */
export const STARTER_BLOB_Y = physics.starterBlobY;

/** How long the blob may rest on a pad before it auto-launches (seconds). */
export const AUTO_LAUNCH_DELAY = physics.autoLaunchDelay;

/** Death threshold: fall this far below the lowest nearby platform → game over. */
export const DEATH_FALL_DISTANCE = physics.deathFallDistance;

/** Lateral world bounds (blob bounces off these). */
export const WORLD_BOUND_XZ = physics.worldBoundXZ;

/** Impact speed that maps to a full-strength (1.0) squash/squint. */
export const MAX_IMPACT_SPEED = physics.maxImpactSpeed;
