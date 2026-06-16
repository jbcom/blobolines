/**
 * Input intent model — pure, framework-agnostic math that turns raw drag/keyboard
 * input into game intents. Two control modes from the PoC:
 *   - SLINGSHOT (blob locked on a trampoline): drag back to aim + charge, release to
 *     launch. Drag vector → aim direction + [0,1] strength.
 *   - AIR-STEER (blob airborne): drag anywhere → a 3D steering force on the X/Z plane.
 * The React layer (app/hooks/useInput) feeds pixel deltas here; this file has no DOM.
 */

export interface AimResult {
  /** Unit-ish launch direction (x,y,z); y biased upward for the climb. */
  dir: readonly [number, number, number];
  /** Charge strength in [0,1]. */
  strength: number;
}

export interface SlingshotConfig {
  /** Pixels of drag for full strength (before sensitivity). */
  maxDragDist: number;
  /** Player sensitivity multiplier. */
  sensitivity: number;
}

export const DEFAULT_SLINGSHOT: SlingshotConfig = {
  maxDragDist: 140,
  sensitivity: 1,
};

/**
 * Slingshot aim: drag vector (dx,dy) in screen pixels → launch dir + strength.
 * Pull DOWN-RIGHT launches UP-LEFT (drag opposite to launch, like a slingshot).
 * Screen Y maps to world Z (depth); launch always carries strong +Y for the climb.
 */
export function computeAim(
  dx: number,
  dy: number,
  config: SlingshotConfig = DEFAULT_SLINGSHOT,
): AimResult {
  const dist = Math.hypot(dx, dy);
  const strength = Math.min(1, (dist / config.maxDragDist) * config.sensitivity);

  // Heading on the XZ plane from the (negated) drag; bias Y up so launches climb.
  const angleXZ = Math.atan2(-dx, -dy * 1.2);
  let x = Math.sin(angleXZ) * strength;
  const y = 0.35 + strength * 1.62;
  let z = Math.cos(angleXZ) * strength * 1.25;

  // Normalize to a unit direction.
  const len = Math.hypot(x, y, z) || 1;
  x /= len;
  z /= len;
  return { dir: [x, y / len, z], strength };
}

export interface SteerConfig {
  /** Pixels of drag for full steer. */
  maxSteerDist: number;
  /** Pixel deadzone below which no steering happens. */
  deadzone: number;
  /** Max lateral acceleration applied. */
  maxAirSpeed: number;
}

export const DEFAULT_STEER: SteerConfig = {
  maxSteerDist: 90,
  deadzone: 8,
  maxAirSpeed: 15,
};

/**
 * Air-steer: drag (dx,dy) → a force on the world X (left/right) and Z (fwd/back) axes.
 * Drag up = forward (-Z), drag down = backward (+Z). Returns [0,0] inside the deadzone.
 */
export function computeAirSteer(
  dx: number,
  dy: number,
  config: SteerConfig = DEFAULT_STEER,
): readonly [number, number] {
  const dist = Math.hypot(dx, dy);
  if (dist < config.deadzone) return [0, 0];
  const factor = Math.min(1, dist / config.maxSteerDist);
  const angle = Math.atan2(dy, dx);
  return [
    Math.cos(angle) * factor * config.maxAirSpeed,
    Math.sin(angle) * factor * config.maxAirSpeed,
  ];
}

/** Keyboard steering: WASD/arrows → unit force on X/Z scaled by maxAirSpeed. */
export function keyboardSteer(
  keys: { left: boolean; right: boolean; up: boolean; down: boolean },
  maxAirSpeed = DEFAULT_STEER.maxAirSpeed,
): readonly [number, number] {
  const x = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
  const z = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
  if (x === 0 && z === 0) return [0, 0];
  const len = Math.hypot(x, z);
  return [(x / len) * maxAirSpeed, (z / len) * maxAirSpeed];
}
