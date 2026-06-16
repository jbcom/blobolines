import { describe, expect, it } from "vitest";
import { createTrampState, impactTargets, reboundMultiplier, stepTramp } from "../depress";

describe("impactTargets", () => {
  it("depresses downward proportional to impact speed (clamped)", () => {
    expect(impactTargets(0, 0, 0).depress).toBeLessThan(0);
    const soft = impactTargets(5, 0, 0).depress;
    const hard = impactTargets(20, 0, 0).depress;
    expect(hard).toBeLessThan(soft); // harder = deeper (more negative)
  });

  it("clamps depth for extreme impacts", () => {
    const extreme = impactTargets(10000, 0, 0).depress;
    expect(extreme).toBeGreaterThan(-5.5); // force capped at 5.5 → depress ~ -5.39
  });

  it("tilts toward the hit point", () => {
    // Hit on +X side tilts the pad (negative tiltZ by convention).
    expect(impactTargets(15, 0.4, 0).tiltZ).toBeLessThan(0);
    // Hit on +Z side tilts +tiltX.
    expect(impactTargets(15, 0, 0.4).tiltX).toBeGreaterThan(0);
  });

  it("center hit has no tilt", () => {
    const t = impactTargets(15, 0, 0);
    expect(t.tiltX).toBeCloseTo(0, 10);
    expect(t.tiltZ).toBeCloseTo(0, 10);
  });
});

describe("stepTramp", () => {
  it("springs back to rest from a depression", () => {
    let s = createTrampState();
    s = stepTramp(s, { depress: -3, tiltX: 0.3, tiltZ: -0.2 }, 1 / 60);
    // Then release: target back to 0 and settle.
    for (let i = 0; i < 400; i++) {
      s = stepTramp(s, { depress: 0, tiltX: 0, tiltZ: 0 }, 1 / 60);
    }
    expect(s.depress.value).toBeCloseTo(0, 2);
    expect(s.tiltX.value).toBeCloseTo(0, 2);
    expect(s.tiltZ.value).toBeCloseTo(0, 2);
  });

  it("is deterministic", () => {
    const run = () => {
      let s = createTrampState();
      const out: number[] = [];
      for (let i = 0; i < 30; i++) {
        s = stepTramp(s, { depress: -2, tiltX: 0.1, tiltZ: 0 }, 1 / 60);
        out.push(s.depress.value);
      }
      return out;
    };
    expect(run()).toEqual(run());
  });
});

describe("reboundMultiplier", () => {
  it("booster rebounds hardest, standard is the gently-springy baseline", () => {
    expect(reboundMultiplier.booster).toBeGreaterThan(reboundMultiplier.standard);
    // Standard is slightly >1 so a clean drop roughly sustains the climb (a flat 1.0 let
    // physics damping bleed all energy → blob always settled); booster is the big pop.
    expect(reboundMultiplier.standard).toBeGreaterThan(1);
    expect(reboundMultiplier.standard).toBeLessThan(1.3);
  });
});
