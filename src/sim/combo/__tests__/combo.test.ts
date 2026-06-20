import { describe, expect, it } from "vitest";
import {
  breakCombo,
  comboHeat,
  createCombo,
  HEAT_FULL_COMBO,
  MAX_COMBO,
  onCleanBounce,
} from "../combo";

describe("combo tracking", () => {
  it("starts at zero", () => {
    expect(createCombo().streak).toBe(0);
  });

  it("clean bounces build the streak", () => {
    let c = createCombo();
    c = onCleanBounce(c);
    c = onCleanBounce(c);
    expect(c.streak).toBe(2);
  });

  it("caps at MAX_COMBO", () => {
    let c = createCombo();
    for (let i = 0; i < 50; i++) c = onCleanBounce(c);
    expect(c.streak).toBe(MAX_COMBO);
  });

  it("breaking resets to zero", () => {
    const built = onCleanBounce(onCleanBounce(createCombo()));
    expect(built.streak).toBe(2);
    expect(breakCombo().streak).toBe(0);
  });

  it("calculates combo visual heat correctly (ramp ceiling = HEAT_FULL_COMBO, decoupled from cap)", () => {
    expect(comboHeat(0)).toBe(0);
    expect(comboHeat(4)).toBe(4 / HEAT_FULL_COMBO);
    expect(comboHeat(HEAT_FULL_COMBO)).toBe(1);
    // Combos ABOVE the heat ceiling (and the raised MAX_COMBO) stay clamped at full heat.
    expect(comboHeat(HEAT_FULL_COMBO + 2)).toBe(1);
    expect(comboHeat(MAX_COMBO)).toBe(1);

    expect(comboHeat(0, 2)).toBe(0);
    expect(comboHeat(2, 2)).toBe(0);
    expect(comboHeat(5, 2)).toBe((5 - 2) / (HEAT_FULL_COMBO - 2));
    expect(comboHeat(HEAT_FULL_COMBO, 2)).toBe(1);
  });
});
