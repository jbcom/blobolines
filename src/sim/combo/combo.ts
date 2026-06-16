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

/** The HUD multiplier label value for a streak (1.0x below 2). */
export function comboLabel(streak: number): number {
  return streak < 2 ? 1 : 1 + (streak - 1) * 0.5;
}
