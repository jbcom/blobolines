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
