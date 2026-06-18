/**
 * Input intent model — pure, framework-agnostic math that turns raw drag/keyboard
 * input into game intents. Two control modes:
 *   - ROUTE CHARGE (blob locked on a trampoline): hold on the blob to charge the certified
 *     next-hop thrust, release to launch. Time held → [0,1] strength.
 *   - AIR-STEER (blob airborne): drag anywhere → a 3D steering force on the X/Z plane.
 * The React layer (app/hooks/useInput) feeds pixel deltas here; this file has no DOM.
 */

export interface AimResult {
  /** Unit-ish launch direction (x,y,z); y biased upward for the climb. */
  dir: readonly [number, number, number];
  /** Charge strength in [0,1]. */
  strength: number;
}

export interface HoldChargeConfig {
  /** Seconds held for full charge at sensitivity 1. */
  fullChargeSeconds: number;
  /** Minimum useful launch on a quick tap/release. */
  tapCharge: number;
  /** Player sensitivity multiplier; higher charges faster. */
  sensitivity: number;
}

export const DEFAULT_HOLD_CHARGE: HoldChargeConfig = {
  fullChargeSeconds: 1.15,
  tapCharge: 0.22,
  sensitivity: 1,
};

export const ROUTE_AIM_Z_SCALE = 1.25;

/** Hold-to-charge thrust: a quick tap still produces a small route-aligned pop, while holding
 *  reaches full charge on a readable cadence. */
export function computeHoldCharge(
  heldSeconds: number,
  config: HoldChargeConfig = DEFAULT_HOLD_CHARGE,
): number {
  const seconds = Math.max(0, heldSeconds);
  const rate = Math.max(0.1, config.sensitivity);
  const full = Math.max(0.2, config.fullChargeSeconds / rate);
  const ramp = Math.min(1, seconds / full);
  if (ramp <= 0) return 0;
  return Math.max(Math.min(1, config.tapCharge), ramp);
}

/**
 * Route-bearing launch direction for flat sources. This is intentionally the same
 * charge-shaped parabola direction used by the world verifier: no swipe aim, but charge still
 * changes the vertical/lateral angle the player must hit.
 */
export function computeRouteAim(
  deltaX: number,
  deltaZ: number,
  charge: number,
): readonly [number, number, number] {
  const h = Math.hypot(deltaX, deltaZ);
  if (h < 1e-6) return [0, 1, 0];
  const ux = deltaX / h;
  const uz = deltaZ / h;
  const c = Math.max(0, Math.min(1, charge));
  const angle = Math.atan2(ROUTE_AIM_Z_SCALE * ux, uz);
  const x = Math.sin(angle) * c;
  const y = 0.35 + c * 1.62;
  const z = Math.cos(angle) * c * ROUTE_AIM_Z_SCALE;
  const len = Math.hypot(x, y, z) || 1;
  return [x / len, y / len, z / len];
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
