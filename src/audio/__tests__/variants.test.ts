import { describe, expect, it } from "vitest";
import { createPitchVariation, createVariantPicker } from "../variants";

describe("createVariantPicker", () => {
  it("always returns 0 for a single variant", () => {
    const p = createVariantPicker(1);
    for (let i = 0; i < 5; i++) expect(p.next()).toBe(0);
  });

  it("never repeats the same index twice in a row", () => {
    // Adversarial rand that would pick the same raw index repeatedly — the picker must still
    // remap to avoid the immediate repeat.
    const p = createVariantPicker(4, () => 0); // always picks the lowest available
    let prev = -1;
    for (let i = 0; i < 20; i++) {
      const n = p.next();
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(4);
      expect(n).not.toBe(prev);
      prev = n;
    }
  });

  it("can return index 0 on the FIRST call (no first-pick bias away from 0)", () => {
    // rand→0 picks the lowest available; the first call must be free to return 0.
    expect(createVariantPicker(2, () => 0).next()).toBe(0);
    expect(createVariantPicker(5, () => 0).next()).toBe(0);
  });

  it("can reach every index over many draws", () => {
    let seed = 0.123;
    const rand = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    const p = createVariantPicker(5, rand);
    const seen = new Set<number>();
    for (let i = 0; i < 200; i++) seen.add(p.next());
    expect(seen.size).toBe(5);
  });
});

describe("createPitchVariation", () => {
  it("returns a value from the step set, never repeating adjacent", () => {
    const steps = [0.9, 1.0, 1.1, 1.2];
    const pitch = createPitchVariation(steps, () => 0.5);
    let prev = Number.NaN;
    for (let i = 0; i < 12; i++) {
      const r = pitch();
      expect(steps).toContain(r);
      expect(r).not.toBe(prev);
      prev = r;
    }
  });
});
