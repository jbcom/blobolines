import { score as scoreCfg } from "@/config";
import { MAX_COMBO } from "@/sim/combo";

/**
 * Composite run score — pure + deterministic. Height is the spine of the climb, but a real
 * score rewards the other two skill axes too: collecting crystals (exploration / risk) and
 * sustaining clean-bounce combos (style). Kept here as one function so the HUD, the game-over
 * recap, and the persisted high score all agree, and so the weighting is unit-tested rather
 * than scattered across UI.
 */

export interface ScoreInputs {
  /** Metres climbed this run. */
  height: number;
  /** Crystals collected this run. */
  crystals: number;
  /** Highest clean-bounce combo reached this run. */
  maxCombo: number;
}

/**
 * Sum of the geometric series base·growth^i for i in [0, n). Pure + total: at growth === 1 the
 * closed form base·(growth^n − 1)/(growth − 1) divides by zero, so fall back to the degenerate
 * linear sum base·n. Exported so the growth===1 edge is unit-testable independent of config.
 */
export function geometricSum(base: number, growth: number, n: number): number {
  if (n <= 0) return 0;
  if (growth === 1) return base * n;
  return (base * (growth ** n - 1)) / (growth - 1);
}

/**
 * Style bonus for the run's best combo streak. Geometric so a long streak is worth
 * disproportionately more than a short one (the payoff for keeping a clean chain alive):
 * sum of base·growth^i for i in [0, maxCombo). maxCombo 0 → 0.
 */
export function comboStyleBonus(maxCombo: number): number {
  if (maxCombo <= 0) return 0;
  const { comboStyleBase, comboStyleGrowth } = scoreCfg;
  // Self-defending: clamp to the gameplay combo cap so a stray uncapped caller (test/replay)
  // can't make growth^n explode. The combo state already caps at MAX_COMBO in sim/combo.
  const n = Math.min(Math.floor(maxCombo), MAX_COMBO);
  return Math.round(geometricSum(comboStyleBase, comboStyleGrowth, n));
}

/** Total run score (integer). height·heightPoints + crystals·crystalPoints + combo style. */
export function computeScore({ height, crystals, maxCombo }: ScoreInputs): number {
  const { heightPoints, crystalPoints } = scoreCfg;
  const h = Math.max(0, Math.floor(height)) * heightPoints;
  const c = Math.max(0, Math.floor(crystals)) * crystalPoints;
  return h + c + comboStyleBonus(maxCombo);
}
