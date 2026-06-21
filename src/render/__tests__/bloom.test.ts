import { Color } from "three";
import { describe, expect, it } from "vitest";
import { BLOOM_THRESHOLD, emissiveForBloom } from "../bloom";

/** Linear luminance of a hex color, matching emissiveForBloom's internal metric. */
function linearLuminance(hex: string): number {
  const c = new Color().set(hex);
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
}

describe("emissiveForBloom", () => {
  it("sizes intensity so emissive(color) × intensity clears the bloom threshold", () => {
    // For any color, the emissive luminance (color luminance × returned intensity) must exceed
    // BLOOM_THRESHOLD — otherwise the bloom-target material would not bloom (the washout-fix bug:
    // a high threshold silently dropped under-bright emissives).
    for (const hex of ["#ff6f61", "#f2c14e", "#ff5ab3", "#ffe7a3", "#f08a3c", "#f7a72e"]) {
      const intensity = emissiveForBloom(hex);
      const emissiveLuminance = linearLuminance(hex) * intensity;
      expect(emissiveLuminance).toBeGreaterThan(BLOOM_THRESHOLD);
    }
  });

  it("gives dimmer colors a HIGHER intensity than brighter ones (same glow floor)", () => {
    // A dark violet must be driven harder than a bright cream to reach the same emissive floor.
    const dim = emissiveForBloom("#ff5ab3"); // violet — lower luminance
    const bright = emissiveForBloom("#ffe7a3"); // ice cream — higher luminance
    expect(dim).toBeGreaterThan(bright);
  });

  it("clamps the divisor so a near-black color cannot produce an unbounded intensity", () => {
    // Black would divide by ~0 without the floor; assert it stays finite and reasonable.
    const black = emissiveForBloom("#000000");
    expect(Number.isFinite(black)).toBe(true);
    expect(black).toBeLessThan(200);
  });

  it("scales with the headroom argument", () => {
    expect(emissiveForBloom("#ff6f61", 2)).toBeGreaterThan(emissiveForBloom("#ff6f61", 1));
  });
});
