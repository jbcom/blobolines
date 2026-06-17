import { describe, expect, it } from "vitest";
import { WIND_START, windAt } from "../wind";

const mag = (v: readonly [number, number]) => Math.hypot(v[0], v[1]);

describe("windAt", () => {
  it("is calm (zero) below the stratosphere start", () => {
    for (const h of [0, 100, WIND_START - 1, WIND_START]) {
      expect(mag(windAt(h, 5))).toBe(0);
    }
  });

  it("ramps in above the start and is non-zero up high", () => {
    const low = mag(windAt(WIND_START + 50, 5));
    const high = mag(windAt(WIND_START + 400, 5));
    expect(low).toBeGreaterThan(0);
    expect(high).toBeGreaterThan(low); // ramp not yet full at +50, full by +400
  });

  it("magnitude stays bounded (never an unfair shove)", () => {
    let peak = 0;
    for (let h = WIND_START; h < WIND_START + 800; h += 25) {
      for (let t = 0; t < 40; t += 0.5) peak = Math.max(peak, mag(windAt(h, t)));
    }
    // Peak ≤ WIND_ACCEL (9) and strictly less than the player's 15 m/s² steer budget so the
    // gust is always counterable.
    expect(peak).toBeLessThanOrEqual(9.001);
    expect(peak).toBeLessThan(15);
  });

  it("is deterministic for the same (height, time)", () => {
    expect(windAt(800, 12.34)).toEqual(windAt(800, 12.34));
  });

  it("the gust direction rotates over time (not a constant one-way shove)", () => {
    const a = windAt(900, 0);
    const b = windAt(900, 10);
    // Different headings at different times.
    expect(a).not.toEqual(b);
  });
});
