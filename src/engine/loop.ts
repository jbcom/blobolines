/**
 * Fixed-timestep accumulator — the deterministic heart of the sim. Render frames vary
 * (30–144 Hz), but the sim always advances in fixed FIXED_DT steps so physics, springs,
 * and the height-chase are reproducible regardless of frame rate. Pure: no R3F, no DOM;
 * the React side (app/hooks/useGameLoop) feeds it wall deltas and runs the step fn.
 *
 * Accumulator pattern adapted from arcade-cabinet (marmalade-drops usePinballLoop).
 */

export const FIXED_DT = 1 / 60;
/** Cap on how much sim time one frame may advance, so a stall can't spiral. */
export const MAX_FRAME_DELTA = 1 / 15;
/** Hard cap on steps per frame (belt-and-suspenders against the spiral of death). */
export const MAX_STEPS_PER_FRAME = 5;

export interface StepLoopState {
  accumulator: number;
  /** Fractional progress toward the next step, for render interpolation [0,1). */
  alpha: number;
  /** Total fixed steps executed since creation. */
  steps: number;
}

export function createStepLoop(): StepLoopState {
  return { accumulator: 0, alpha: 0, steps: 0 };
}

/**
 * Advance the loop by a wall delta, invoking `step(FIXED_DT)` zero or more times.
 * Returns how many fixed steps ran this frame. Mutates `state`.
 */
export function advance(
  state: StepLoopState,
  frameDelta: number,
  step: (dt: number) => void,
): number {
  const clamped = Math.min(Math.max(0, frameDelta), MAX_FRAME_DELTA);
  state.accumulator += clamped;

  let ran = 0;
  while (state.accumulator + 1e-9 >= FIXED_DT && ran < MAX_STEPS_PER_FRAME) {
    step(FIXED_DT);
    state.accumulator -= FIXED_DT;
    state.steps += 1;
    ran += 1;
  }

  // If we hit the step cap, drop leftover time rather than carry a growing debt.
  if (ran >= MAX_STEPS_PER_FRAME && state.accumulator > FIXED_DT) {
    state.accumulator = 0;
  }

  state.alpha = state.accumulator / FIXED_DT;
  return ran;
}
