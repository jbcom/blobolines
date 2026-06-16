import { describe, expect, it } from "vitest";
import { breakCombo, createCombo, MAX_COMBO, onCleanBounce } from "../combo";

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
});
