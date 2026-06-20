import { describe, expect, it } from "vitest";
import { score as cfg } from "@/config";
import { MAX_COMBO } from "@/sim/combo";
import {
  comboStyleBonus,
  computeScore,
  geometricSum,
  goldenPathLandingBonus,
  goldenPathLandingQuality,
} from "../score";

describe("geometricSum", () => {
  it("sums base·growth^i for i in [0,n) via the closed form", () => {
    // 2·1.5^0 + 2·1.5^1 + 2·1.5^2 = 2 + 3 + 4.5 = 9.5
    expect(geometricSum(2, 1.5, 3)).toBeCloseTo(9.5, 6);
  });
  it("handles growth === 1 (degenerate linear sum, no divide-by-zero)", () => {
    expect(geometricSum(2, 1, 4)).toBe(8); // 2·4, not NaN
    expect(Number.isNaN(geometricSum(2, 1, 4))).toBe(false);
  });
  it("is 0 at n <= 0", () => {
    expect(geometricSum(5, 2, 0)).toBe(0);
    expect(geometricSum(5, 2, -3)).toBe(0);
  });
});

describe("computeScore", () => {
  it("is zero for a no-op run", () => {
    expect(computeScore({ height: 0, crystals: 0, maxCombo: 0 })).toBe(0);
  });

  it("weights height by heightPoints", () => {
    expect(computeScore({ height: 100, crystals: 0, maxCombo: 0 })).toBe(100 * cfg.heightPoints);
  });

  it("adds crystal points", () => {
    const base = computeScore({ height: 50, crystals: 0, maxCombo: 0 });
    expect(computeScore({ height: 50, crystals: 3, maxCombo: 0 })).toBe(
      base + 3 * cfg.crystalPoints,
    );
  });

  it("floors fractional height/crystals (height is metres, not sub-metre)", () => {
    expect(computeScore({ height: 100.9, crystals: 2.7, maxCombo: 0 })).toBe(
      100 * cfg.heightPoints + 2 * cfg.crystalPoints,
    );
  });

  it("clamps negative inputs to zero (never a negative score)", () => {
    expect(computeScore({ height: -10, crystals: -5, maxCombo: -3, stylePoints: -10 })).toBe(0);
  });

  it("rewards a longer combo streak super-linearly (style payoff)", () => {
    // Two combos of 3 vs one combo of 6: the single long streak must score MORE than the sum
    // of the two short ones — that's the geometric style bonus doing its job.
    const long = comboStyleBonus(6);
    const twoShort = comboStyleBonus(3) * 2;
    expect(long).toBeGreaterThan(twoShort);
  });

  it("combo bonus is monotonic and zero at zero", () => {
    expect(comboStyleBonus(0)).toBe(0);
    let prev = -1;
    // Cover the FULL combo range up to (and one past) the cap, derived from MAX_COMBO so the raise
    // to 12 doesn't leave 11/12 unchecked.
    for (let c = 0; c <= MAX_COMBO + 1; c++) {
      const b = comboStyleBonus(c);
      expect(b).toBeGreaterThanOrEqual(prev);
      prev = b;
    }
  });

  it("self-clamps combo to the gameplay cap (no runaway for a stray uncapped caller)", () => {
    // Anything beyond MAX_COMBO must not grow the bonus (guards growth^n explosion). Derived from
    // the cap so a future cap change can't silently leave this asserting a stale value.
    const atCap = comboStyleBonus(MAX_COMBO);
    expect(comboStyleBonus(MAX_COMBO + 42)).toBe(atCap);
    expect(comboStyleBonus(1000)).toBe(atCap);
  });

  it("the rebalanced max-combo bonus stays bounded (the higher cap adds granularity, not inflation)", () => {
    // MAX_COMBO rose 8→12 with comboStyleGrowth lowered (1.38→1.18), so the TOP-end style bonus must
    // not blow up — the new max-combo bonus stays in the same ballpark as the prior tuning's ceiling
    // (a touch above, rewarding the harder combo, not a runaway). Locks the rebalance intent.
    const maxBonus = comboStyleBonus(MAX_COMBO);
    expect(maxBonus).toBeGreaterThan(800); // still a meaningful reward
    expect(maxBonus).toBeLessThan(1300); // but NOT the ~3400 a naive 1.38^12 sum would give
    // Monotonic + smoothly increasing: each extra combo level adds a positive, non-explosive step.
    for (let c = 1; c < MAX_COMBO; c++) {
      const step = comboStyleBonus(c + 1) - comboStyleBonus(c);
      expect(step, `step ${c}→${c + 1}`).toBeGreaterThan(0);
    }
  });

  it("combines all three axes", () => {
    const s = computeScore({ height: 120, crystals: 4, maxCombo: 5 });
    expect(s).toBe(120 * cfg.heightPoints + 4 * cfg.crystalPoints + comboStyleBonus(5));
  });

  it("adds route style points", () => {
    expect(computeScore({ height: 10, crystals: 1, maxCombo: 0, stylePoints: 37 })).toBe(
      10 * cfg.heightPoints + cfg.crystalPoints + 37,
    );
  });
});

describe("goldenPathLandingBonus", () => {
  it("normalizes quality from perfect to edge", () => {
    expect(goldenPathLandingQuality(0, 4)).toBe(1);
    expect(goldenPathLandingQuality(2, 4)).toBe(0.5);
    expect(goldenPathLandingQuality(4, 4)).toBe(0);
  });

  it("awards max points at the certified landing point", () => {
    expect(goldenPathLandingBonus(0, 4)).toBe(cfg.goldenPathPerfectPoints);
  });

  it("falls off quadratically toward the target edge", () => {
    const half = goldenPathLandingBonus(2, 4);
    expect(half).toBeGreaterThan(0);
    expect(half).toBeLessThan(cfg.goldenPathPerfectPoints / 2);
  });

  it("awards nothing outside the footprint", () => {
    expect(goldenPathLandingBonus(5, 4)).toBe(0);
    expect(goldenPathLandingBonus(0, 0)).toBe(0);
  });
});
