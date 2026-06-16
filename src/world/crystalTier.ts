import type { Rng } from "@/core/math";
import type { CrystalTier } from "@/core/types";

/**
 * Crystal rarity tiers (pure, seeded). Crystals were a flat +1; now each has a tier worth
 * more crystals (and so more score) the rarer it is. Rare/radiant odds RISE with altitude, so
 * climbing higher is rewarded with juicier gems — pairs with the score system (value = crystal
 * count, no separate score path) and the altitude difficulty curve.
 */

/** Crystals (and score, via crystalPoints) awarded per tier. */
export const CRYSTAL_VALUE: Record<CrystalTier, number> = {
  common: 1,
  rare: 3,
  radiant: 8,
};

/** Visual scale multiplier per tier (radiant gems are bigger + read as a prize). */
export const CRYSTAL_SCALE: Record<CrystalTier, number> = {
  common: 1,
  rare: 1.35,
  radiant: 1.8,
};

/**
 * Roll a crystal tier for altitude `y`. Rare/radiant probabilities ramp from ~0 at the start
 * to a cap high up; the rest is common. Deterministic given `rng`.
 */
export function pickCrystalTier(rng: Rng, y: number): CrystalTier {
  // 0 at the ground → 1 by ~500m; gates how generous the rare/radiant odds get.
  const climb = Math.min(1, Math.max(0, y / 500));
  const radiantChance = 0.02 + 0.08 * climb; // 2% → 10%
  const rareChance = 0.1 + 0.18 * climb; //   10% → 28%
  const roll = rng.next();
  if (roll < radiantChance) return "radiant";
  if (roll < radiantChance + rareChance) return "rare";
  return "common";
}
