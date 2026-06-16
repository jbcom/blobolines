/**
 * Spring & interpolation helpers — the math behind trampoline depress, blob
 * squash-spring-back, camera follow, and eye expression easing. Pure functions;
 * deterministic given their inputs.
 */

export const clamp = (v: number, min: number, max: number): number =>
  v < min ? min : v > max ? max : v;

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export const inverseLerp = (a: number, b: number, v: number): number =>
  a === b ? 0 : (v - a) / (b - a);

/** Frame-rate independent exponential approach: fraction to cover this step. Negative
 *  dt is clamped to 0 so the result always stays in [0, 1). */
export const damp = (dt: number, tau: number): number =>
  1 - Math.exp(-Math.max(dt, 0) / Math.max(tau, 1e-6));

/** Ease-out cubic — the spring-back curve for squash/stretch and eye states. */
export const easeOutCubic = (t: number): number => 1 - (1 - t) ** 3;

/** Bouncy overshoot ease (matches the --ease-bounce CSS token). */
export const easeOutBack = (t: number): number => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
};

export interface SpringState {
  value: number;
  velocity: number;
}

export interface SpringConfig {
  /** Higher = snappier. */
  stiffness: number;
  /** Higher = settles faster / less bounce. */
  damping: number;
}

/**
 * Critically-style damped spring step (the `-k·x - c·v` model from the PoC
 * trampolines), integrated semi-implicitly for stability.
 */
export function stepSpring(
  state: SpringState,
  target: number,
  config: SpringConfig,
  dt: number,
): SpringState {
  const force = -config.stiffness * (state.value - target) - config.damping * state.velocity;
  const velocity = state.velocity + force * dt;
  const value = state.value + velocity * dt;
  return { value, velocity };
}
