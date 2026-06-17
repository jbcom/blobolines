import { describe, expect, it } from "vitest";
import { score as cfg } from "@/config";
import { comboStyleBonus, computeScore, geometricSum } from "../score";

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
    expect(computeScore({ height: -10, crystals: -5, maxCombo: -3 })).toBe(0);
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
    for (let c = 0; c <= 10; c++) {
      const b = comboStyleBonus(c);
      expect(b).toBeGreaterThanOrEqual(prev);
      prev = b;
    }
  });

  it("self-clamps combo to the gameplay cap (no runaway for a stray uncapped caller)", () => {
    // MAX_COMBO is 8; anything beyond must not grow the bonus (guards growth^n explosion).
    const atCap = comboStyleBonus(8);
    expect(comboStyleBonus(50)).toBe(atCap);
    expect(comboStyleBonus(1000)).toBe(atCap);
  });

  it("combines all three axes", () => {
    const s = computeScore({ height: 120, crystals: 4, maxCombo: 5 });
    expect(s).toBe(120 * cfg.heightPoints + 4 * cfg.crystalPoints + comboStyleBonus(5));
  });
});
