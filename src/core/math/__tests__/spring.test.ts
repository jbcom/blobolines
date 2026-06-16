import { describe, expect, it } from "vitest";
import { clamp, damp, easeOutBack, easeOutCubic, inverseLerp, lerp, stepSpring } from "../spring";

describe("interpolation helpers", () => {
  it("clamp bounds a value", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(99, 0, 10)).toBe(10);
  });

  it("lerp / inverseLerp are inverses", () => {
    expect(lerp(0, 10, 0.5)).toBe(5);
    expect(inverseLerp(0, 10, 5)).toBe(0.5);
    expect(inverseLerp(4, 4, 4)).toBe(0);
  });

  it("damp returns a fraction in (0,1) that grows with dt", () => {
    const small = damp(1 / 120, 0.2);
    const large = damp(1 / 30, 0.2);
    expect(small).toBeGreaterThan(0);
    expect(large).toBeLessThan(1);
    expect(large).toBeGreaterThan(small);
  });

  it("easing curves hit their endpoints", () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    expect(easeOutBack(0)).toBeCloseTo(0, 5);
    expect(easeOutBack(1)).toBeCloseTo(1, 5);
  });
});

describe("stepSpring", () => {
  it("converges toward the target and settles", () => {
    let s = { value: 0, velocity: 0 };
    const cfg = { stiffness: 170, damping: 26 };
    for (let i = 0; i < 600; i++) {
      s = stepSpring(s, 1, cfg, 1 / 120);
    }
    expect(s.value).toBeCloseTo(1, 2);
    expect(Math.abs(s.velocity)).toBeLessThan(0.01);
  });

  it("stays stable at the clock's default maxDelta (1/30) with the standard config", () => {
    // Regression: stiffness 170 diverged at the old maxDelta of 1/15. The clock now
    // caps at 1/30, which must keep the documented trampoline spring config stable.
    let s = { value: 0, velocity: 0 };
    const cfg = { stiffness: 170, damping: 26 };
    for (let i = 0; i < 400; i++) {
      s = stepSpring(s, 1, cfg, 1 / 30);
      expect(Number.isFinite(s.value)).toBe(true);
      expect(Math.abs(s.value)).toBeLessThan(5);
    }
    expect(s.value).toBeCloseTo(1, 1);
  });

  it("is deterministic", () => {
    const run = () => {
      let s = { value: -3, velocity: 2 };
      const out: number[] = [];
      for (let i = 0; i < 50; i++) {
        s = stepSpring(s, 0, { stiffness: 120, damping: 14 }, 1 / 60);
        out.push(s.value);
      }
      return out;
    };
    expect(run()).toEqual(run());
  });
});
