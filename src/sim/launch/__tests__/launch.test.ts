import { describe, expect, it } from "vitest";
import { BASE_POWER, comboMultiplier, launchVelocity } from "../launch";

describe("comboMultiplier", () => {
  it("is 1 below a streak of 2", () => {
    expect(comboMultiplier(0)).toBe(1);
    expect(comboMultiplier(1)).toBe(1);
  });

  it("compounds with the streak", () => {
    expect(comboMultiplier(2)).toBeCloseTo(1.15, 5);
    expect(comboMultiplier(3)).toBeCloseTo(1.3, 5);
  });
});

describe("launchVelocity", () => {
  const up = [0, 1, 0] as const;

  it("base power at zero charge straight up", () => {
    const v = launchVelocity(up, 0, "standard", 0);
    expect(v[1]).toBeCloseTo(BASE_POWER, 5);
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
});
