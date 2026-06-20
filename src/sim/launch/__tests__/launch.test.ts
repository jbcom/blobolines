import { describe, expect, it } from "vitest";
import { reboundMultiplier } from "@/sim/trampoline";
import {
  BASE_POWER,
  comboMultiplier,
  isPerfectRelease,
  launchVelocity,
  PERFECT_RELEASE,
  perfectReleaseMultiplier,
} from "../launch";

describe("comboMultiplier", () => {
  it("is 1 below a streak of 2", () => {
    expect(comboMultiplier(0)).toBe(1);
    expect(comboMultiplier(1)).toBe(1);
  });

  it("compounds with the streak (1 + (combo - start + 1)·step from comboStart)", () => {
    // comboStart = 2, comboStep = 0.12 → first bonus at combo 2 is +step, then +step per bounce.
    expect(comboMultiplier(2)).toBeCloseTo(1.12, 5);
    expect(comboMultiplier(3)).toBeCloseTo(1.24, 5);
  });
});

describe("launchVelocity", () => {
  const up = [0, 1, 0] as const;

  it("base power at zero charge straight up (scaled by the pad's rebound)", () => {
    const v = launchVelocity(up, 0, "standard", 0);
    expect(v[1]).toBeCloseTo(BASE_POWER * reboundMultiplier.standard, 5);
    expect(v[0]).toBe(0);
    expect(v[2]).toBe(0);
  });

  it("charge increases power", () => {
    const low = launchVelocity(up, 0, "standard", 0)[1];
    const high = launchVelocity(up, 1, "standard", 0)[1];
    expect(high).toBeGreaterThan(low);
  });

  it("booster pads launch higher than standard", () => {
    const std = launchVelocity(up, 1, "standard", 0)[1];
    const boost = launchVelocity(up, 1, "booster", 0)[1];
    expect(boost).toBeGreaterThan(std);
  });

  it("combo streak multiplies launch power", () => {
    const solo = launchVelocity(up, 1, "standard", 1)[1];
    const combo = launchVelocity(up, 1, "standard", 4)[1];
    expect(combo).toBeGreaterThan(solo);
  });

  it("carries direction into all axes", () => {
    const v = launchVelocity([0.6, 0.7, -0.3], 0.5, "standard", 0);
    expect(v[0]).toBeGreaterThan(0);
    expect(v[1]).toBeGreaterThan(0);
    expect(v[2]).toBeLessThan(0);
  });

  it("a perfect-release charge gets the power bonus", () => {
    const mid = (PERFECT_RELEASE.min + PERFECT_RELEASE.max) / 2;
    const justUnder = launchVelocity(up, PERFECT_RELEASE.min - 0.02, "standard", 0)[1];
    const perfect = launchVelocity(up, mid, "standard", 0)[1];
    // Despite being a LOWER charge, the perfect-window launch out-powers one just below the band.
    expect(perfect).toBeGreaterThan(justUnder);
    // And it beats the same charge without the bonus by exactly the bonus factor.
    const base = (BASE_POWER + mid * 17.5) * reboundMultiplier.standard;
    expect(perfect).toBeCloseTo(base * PERFECT_RELEASE.bonus, 4);
  });
});

describe("perfect release window", () => {
  it("isPerfectRelease only inside the band", () => {
    expect(isPerfectRelease(PERFECT_RELEASE.min - 0.01)).toBe(false);
    expect(isPerfectRelease(PERFECT_RELEASE.min)).toBe(true);
    expect(isPerfectRelease((PERFECT_RELEASE.min + PERFECT_RELEASE.max) / 2)).toBe(true);
    expect(isPerfectRelease(PERFECT_RELEASE.max)).toBe(true);
    expect(isPerfectRelease(PERFECT_RELEASE.max + 0.01)).toBe(false); // over-charge misses it
    expect(isPerfectRelease(1)).toBe(false); // full charge is past the window
  });

  it("perfectReleaseMultiplier is the bonus inside the band, 1 outside", () => {
    expect(perfectReleaseMultiplier(0.5)).toBe(1);
    expect(perfectReleaseMultiplier(1)).toBe(1);
    expect(perfectReleaseMultiplier((PERFECT_RELEASE.min + PERFECT_RELEASE.max) / 2)).toBe(
      PERFECT_RELEASE.bonus,
    );
  });
});
