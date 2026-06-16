import { describe, expect, it } from "vitest";
import { createClock } from "../clock";

describe("createClock", () => {
  it("first tick is zero and establishes the origin", () => {
    const c = createClock();
    expect(c.tick(100)).toBe(0);
    expect(c.elapsed()).toBe(0);
  });

  it("returns the delta between ticks", () => {
    const c = createClock({ maxDelta: 1 });
    c.tick(10);
    expect(c.tick(10.5)).toBeCloseTo(0.5, 6);
    expect(c.elapsed()).toBeCloseTo(0.5, 6);
  });

  it("clamps large deltas to maxDelta", () => {
    const c = createClock({ maxDelta: 0.1 });
    c.tick(0);
    expect(c.tick(5)).toBe(0.1);
  });

  it("elapsed() accumulates CLAMPED sim time, not wall-clock", () => {
    const c = createClock({ maxDelta: 0.1 });
    c.tick(0);
    c.tick(5); // wall jump of 5s, but clamped to 0.1
    expect(c.elapsed()).toBeCloseTo(0.1, 6);
    c.tick(5.05); // +0.05
    expect(c.elapsed()).toBeCloseTo(0.15, 6);
  });

  it("defaults maxDelta to 1/30", () => {
    const c = createClock();
    c.tick(0);
    expect(c.tick(10)).toBeCloseTo(1 / 30, 6);
  });

  it("never returns negative deltas", () => {
    const c = createClock();
    c.tick(10);
    expect(c.tick(9)).toBe(0);
  });

  it("reset re-establishes the origin on next tick", () => {
    const c = createClock();
    c.tick(0);
    c.tick(1);
    c.reset();
    expect(c.tick(50)).toBe(0);
    expect(c.elapsed()).toBe(0);
  });
});
