import { score as scoreCfg } from "@/config";

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
 * Style bonus for the run's best combo streak. Geometric so a long streak is worth
 * disproportionately more than a short one (the payoff for keeping a clean chain alive):
 * sum of base·growth^i for i in [0, maxCombo). maxCombo 0 → 0.
 */
export function comboStyleBonus(maxCombo: number): number {
  if (maxCombo <= 0) return 0;
  const { comboStyleBase, comboStyleGrowth } = scoreCfg;
  // Closed-form geometric series: base·(growth^n − 1)/(growth − 1).
  const g = comboStyleGrowth;
  const n = Math.floor(maxCombo);
  return Math.round((comboStyleBase * (g ** n - 1)) / (g - 1));
}

/** Total run score (integer). height·heightPoints + crystals·crystalPoints + combo style. */
export function computeScore({ height, crystals, maxCombo }: ScoreInputs): number {
  const { heightPoints, crystalPoints } = scoreCfg;
  const h = Math.max(0, Math.floor(height)) * heightPoints;
  const c = Math.max(0, Math.floor(crystals)) * crystalPoints;
  return h + c + comboStyleBonus(maxCombo);
}
