import { describe, expect, it } from "vitest";
import { breakCombo, comboLabel, createCombo, MAX_COMBO, onCleanBounce } from "../combo";

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
    let c = createCombo();
    c = onCleanBounce(onCleanBounce(c));
    c = breakCombo();
    expect(c.streak).toBe(0);
  });
});

describe("comboLabel", () => {
  it("is 1x below a streak of 2", () => {
    expect(comboLabel(0)).toBe(1);
    expect(comboLabel(1)).toBe(1);
  });

  it("scales 0.5 per streak above 1", () => {
    expect(comboLabel(2)).toBe(1.5);
    expect(comboLabel(3)).toBe(2);
  });
});
