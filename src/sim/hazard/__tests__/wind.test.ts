import { describe, expect, it } from "vitest";
import { DOWNDRAFT_START, downdraftAt, WIND_START, windAt } from "../wind";

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

describe("downdraftAt", () => {
  it("is zero below the space band", () => {
    for (const h of [0, WIND_START, DOWNDRAFT_START - 1, DOWNDRAFT_START]) {
      expect(downdraftAt(h, 3)).toBe(0);
    }
  });

  it("is non-negative (only ever pulls DOWN) and bounded", () => {
    let peak = 0;
    for (let h = DOWNDRAFT_START; h < DOWNDRAFT_START + 600; h += 25) {
      for (let t = 0; t < 40; t += 0.5) {
        const d = downdraftAt(h, t);
        expect(d).toBeGreaterThanOrEqual(0);
        peak = Math.max(peak, d);
      }
    }
    expect(peak).toBeLessThanOrEqual(12.001);
  });

  it("pulses — mostly calm with periodic surges (not a constant tax)", () => {
    const samples: number[] = [];
    for (let t = 0; t < 14; t += 0.25) samples.push(downdraftAt(DOWNDRAFT_START + 400, t));
    const max = Math.max(...samples);
    const min = Math.min(...samples);
    expect(max).toBeGreaterThan(0);
    expect(min).toBeLessThan(max * 0.2); // dips near-calm between surges
  });

  it("is deterministic", () => {
    expect(downdraftAt(1300, 7.7)).toBe(downdraftAt(1300, 7.7));
  });
});
