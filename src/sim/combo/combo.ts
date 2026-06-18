/**
 * Clean-bounce combo tracking (pure). Landing a trampoline without touching a wall or
 * missing builds a streak that raises the launch multiplier (see sim/launch
 * comboMultiplier) and the HUD combo badge. Breaking out of bounds or dying resets it.
 * Capped so the multiplier stays fair.
 */

export const MAX_COMBO = 8;

export interface ComboState {
  streak: number;
}

export function createCombo(): ComboState {
  return { streak: 0 };
}

/** A clean bounce: increment the streak (capped). */
export function onCleanBounce(state: ComboState): ComboState {
  return { streak: Math.min(state.streak + 1, MAX_COMBO) };
}

/** A miss / wall hit / death: reset the streak. */
export function breakCombo(): ComboState {
  return { streak: 0 };
}

/**
 * Visual heat scale [0, 1] from a combo count, which ramps up the flame/trail visual intensity.
 * Starts heating up above the specified threshold (default 0), and scales to 1.0 at MAX_COMBO.
 */
export function comboHeat(combo: number, threshold = 0): number {
  if (combo <= threshold) return 0;
  return Math.min(1, (combo - threshold) / (MAX_COMBO - threshold));
}
