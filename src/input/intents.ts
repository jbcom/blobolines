/**
 * Input intent model — pure, framework-agnostic math that turns raw drag/keyboard
 * input into game intents. Two control modes:
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
  /** Max lateral ACCELERATION applied (world units / s²). PlayerBlob integrates it as
   *  `v += steer * dt`, so this is m/s², NOT a speed — the climb proof (src/world/reachable)
   *  feeds it straight into ½·a·t², which is only dimensionally sound because it's accel. */
  maxAirAccel: number;
  /** Response curve exponent on the drag→accel ramp. 1 = linear; >1 = eased: a small drag
   *  gives gentle accel (fine aim for curving onto a near pad) while a big drag still commits
   *  to the full lean (the hook onto a far offset pad). The CAP stays maxAirAccel, so the
   *  reachability budget the world generator assumes (src/world/reachable) is unchanged. */
  responseCurve: number;
}

export const DEFAULT_STEER: SteerConfig = {
  maxSteerDist: 90,
  deadzone: 8,
  maxAirAccel: 15,
  responseCurve: 1.7,
};

/**
 * Air-steer: drag (dx,dy) → a lateral ACCELERATION on the world X (left/right) and Z
 * (fwd/back) axes (integrated by PlayerBlob as v += steer·dt). Drag up = forward (-Z),
 * drag down = backward (+Z). Returns [0,0] inside the deadzone.
 *
 * The drag distance past the deadzone is normalized to [0,1] then shaped by responseCurve:
 * fine control near center, a committed lean at the extreme — the "curve / hook" feel that
 * lets a skilled player arc onto an offset pad (complements the canted-pad layout). The peak
 * magnitude is still maxAirAccel so the climb-reachability guarantee holds.
 */
export function computeAirSteer(
  dx: number,
  dy: number,
  config: SteerConfig = DEFAULT_STEER,
): readonly [number, number] {
  const dist = Math.hypot(dx, dy);
  if (dist < config.deadzone) return [0, 0];
  // Normalize past the deadzone so the ramp starts at the edge of it, not at the origin.
  const span = Math.max(1, config.maxSteerDist - config.deadzone);
  const t = Math.min(1, (dist - config.deadzone) / span);
  const factor = config.responseCurve === 1 ? t : t ** config.responseCurve;
  const angle = Math.atan2(dy, dx);
  return [
    Math.cos(angle) * factor * config.maxAirAccel,
    Math.sin(angle) * factor * config.maxAirAccel,
  ];
}

/** Keyboard steering: WASD/arrows → unit lateral acceleration on X/Z scaled by maxAirAccel. */
export function keyboardSteer(
  keys: { left: boolean; right: boolean; up: boolean; down: boolean },
  maxAirAccel = DEFAULT_STEER.maxAirAccel,
): readonly [number, number] {
  const x = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
  const z = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
  if (x === 0 && z === 0) return [0, 0];
  const len = Math.hypot(x, z);
  return [(x / len) * maxAirAccel, (z / len) * maxAirAccel];
}
