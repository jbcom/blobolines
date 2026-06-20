/**
 * Clean-bounce combo tracking (pure). Landing a trampoline without touching a wall or
 * missing builds a streak that raises the launch multiplier (see sim/launch
 * comboMultiplier) and the HUD combo badge. Breaking out of bounds or dying resets it.
 * Capped so the multiplier stays fair.
 */

/** Combo ceiling — raised from 8 to give expert play more skill headroom. The score + launch
 *  rewards are rebalanced (lower comboStyleGrowth + comboStep in config) so the NEW max-combo
 *  reward stays close to the OLD max-combo reward — the higher ceiling adds GRANULARITY (levels
 *  9–12 now reward) rather than inflating the top-end score. */
export const MAX_COMBO = 12;

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
 * Starts heating up above the specified threshold (default 0), and scales to 1.0 at HEAT_FULL_COMBO.
 *
 * The visual ramp ceiling is DECOUPLED from MAX_COMBO on purpose: when the combo cap rose 8→12,
 * tying the heat to MAX_COMBO would have made the flame build ~33% slower (combo 5 → 0.3 heat
 * instead of 0.5), a VFX-responsiveness regression. Pinning full heat at HEAT_FULL_COMBO (8, the
 * prior cap) keeps the mid-combo flame feel identical; combos 9–12 simply stay at max heat (clamped).
 */
export const HEAT_FULL_COMBO = 8;

export function comboHeat(combo: number, threshold = 0): number {
  if (combo <= threshold) return 0;
  return Math.min(1, (combo - threshold) / (HEAT_FULL_COMBO - threshold));
}
