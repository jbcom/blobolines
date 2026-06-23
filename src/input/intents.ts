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

export interface GroundedRouteChargeConfig extends HoldChargeConfig {
  /** Seconds after reaching full charge before the charge drains back to zero. */
  autoDischargeSeconds: number;
  /** Downward pixels from the original touch that scrub one full charge worth of power. */
  dragDischargePx: number;
  /** Downward pixels from the original touch that cancel the launch entirely. */
  cancelDragPx: number;
}

export interface GroundedRouteChargeInput {
  heldSeconds: number;
  /** Positive = finger moved down-screen from the initial blob touch. */
  dragY: number;
  releasing: boolean;
  /** True only for a no-drag tap release; used to preserve the quick-pop affordance. */
  tapEligible: boolean;
  /** Whether this gesture has already carried visible launch charge. */
  wasCharged: boolean;
}

export interface GroundedRouteChargeResult {
  charge: number;
  cancelled: boolean;
  discharged: boolean;
  scrubbed: boolean;
}

export const DEFAULT_GROUNDED_ROUTE_CHARGE: GroundedRouteChargeConfig = {
  ...DEFAULT_HOLD_CHARGE,
  autoDischargeSeconds: 0.95,
  dragDischargePx: 165,
  cancelDragPx: 118,
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

function effectiveFullChargeSeconds(config: HoldChargeConfig): number {
  const rate = Math.max(0.1, config.sensitivity);
  return Math.max(0.2, config.fullChargeSeconds / rate);
}

/**
 * Grounded route charge control for the live hold gesture.
 *
 * Time raises charge, holding past max drains it back down, and dragging the same held finger
 * down-screen scrubs/cancels the pending launch. The return value is intentionally small so
 * React can publish it each frame without owning the timing math.
 */
export function computeGroundedRouteCharge(
  input: GroundedRouteChargeInput,
  config: GroundedRouteChargeConfig = DEFAULT_GROUNDED_ROUTE_CHARGE,
): GroundedRouteChargeResult {
  const dragY = Number.isFinite(input.dragY) ? input.dragY : 0;
  const cancelDrag = Math.max(20, config.cancelDragPx);
  if (dragY >= cancelDrag) {
    return { charge: 0, cancelled: true, discharged: false, scrubbed: true };
  }

  const heldSeconds = Math.max(0, input.heldSeconds);
  const full = effectiveFullChargeSeconds(config);
  const drainSeconds = Math.max(0.1, config.autoDischargeSeconds);
  const overheld = Math.max(0, heldSeconds - full);
  const timeCharge =
    overheld > 0
      ? Math.max(0, 1 - overheld / drainSeconds)
      : computeHoldCharge(heldSeconds, config);
  const scrub = Math.max(0, dragY) / Math.max(1, config.dragDischargePx);
  let charge = Math.max(0, Math.min(1, timeCharge - scrub));
  const discharged =
    overheld >= drainSeconds || (input.wasCharged && timeCharge > 0 && charge <= 0);

  if (input.releasing && input.tapEligible && !input.wasCharged && charge <= 0 && !discharged) {
    charge = Math.min(1, Math.max(0, config.tapCharge));
  }

  return {
    charge,
    cancelled: false,
    discharged,
    scrubbed: scrub > 0,
  };
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

/** Viewport min-dimension the DEFAULT_STEER px thresholds were authored against (a ~tablet). */
const STEER_REFERENCE_MIN_DIM = 820;
/** Full-steer drag as a FRACTION of the viewport min-dimension — the source of truth for the
 *  screen-relative ramp (≈ 90px on the 820px reference). On a 360px phone this is ~40px, so a
 *  full lean is the same SHARE of the screen everywhere instead of a fixed px count that's huge
 *  on a small phone. */
const STEER_FULL_FRACTION = DEFAULT_STEER.maxSteerDist / STEER_REFERENCE_MIN_DIM;
const STEER_DEADZONE_FRACTION = DEFAULT_STEER.deadzone / STEER_REFERENCE_MIN_DIM;

/**
 * Resolve a SteerConfig whose pixel thresholds (maxSteerDist, deadzone) scale with the viewport
 * min-dimension, so the drag distance for a full lean is the same SHARE of the screen on every
 * device. The accel CAP and response curve are unchanged — only the px→[0,1] normalization moves,
 * so the climb-reachability budget (src/world/reachable) is untouched. Clamped so a tiny window
 * never makes steering hair-trigger and a huge one never makes it unreachably long.
 */
export function steerConfigForViewport(
  minDim: number,
  base: SteerConfig = DEFAULT_STEER,
): SteerConfig {
  const dim = Number.isFinite(minDim) && minDim > 0 ? minDim : STEER_REFERENCE_MIN_DIM;
  const maxSteerDist = Math.max(48, Math.min(160, dim * STEER_FULL_FRACTION));
  const deadzone = Math.max(4, Math.min(16, dim * STEER_DEADZONE_FRACTION));
  return { ...base, maxSteerDist, deadzone };
}

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
