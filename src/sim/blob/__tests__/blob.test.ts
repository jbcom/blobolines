import { describe, expect, it } from "vitest";
import { classifyExpression, combineScale, eyeShape, impactSquash, speedStretch } from "../index";

describe("speedStretch", () => {
  it("is round at rest", () => {
    expect(speedStretch(0, 0, 0)).toEqual({ x: 1, y: 1, z: 1 });
  });

  it("stretches Y and shrinks XZ when moving fast (volume-ish conserving)", () => {
    const s = speedStretch(0, 40, 0);
    expect(s.y).toBeGreaterThan(1);
    expect(s.x).toBeLessThan(1);
    expect(s.z).toBeLessThan(1);
  });

  it("saturates at maxStretch", () => {
    const s = speedStretch(0, 1000, 0);
    expect(s.y).toBeCloseTo(1.4, 5);
  });
});

describe("impactSquash", () => {
  it("no squash at zero impact", () => {
    expect(impactSquash(0)).toEqual({ x: 1, y: 1, z: 1 });
  });

  it("flattens Y and bulges XZ on impact", () => {
    const s = impactSquash(1);
    expect(s.y).toBeLessThan(1);
    expect(s.x).toBeGreaterThan(1);
    expect(s.z).toBeGreaterThan(1);
  });
});

describe("combineScale", () => {
  it("multiplies component-wise", () => {
    expect(combineScale({ x: 2, y: 3, z: 4 }, { x: 0.5, y: 2, z: 1 })).toEqual({
      x: 1,
      y: 6,
      z: 4,
    });
  });
});

describe("classifyExpression", () => {
  const base = { vy: 0, impact: 0, fallDepth: 0, airborne: true };

  it("idle by default", () => {
    expect(classifyExpression(base)).toBe("idle");
  });

  it("squints on hard impact", () => {
    expect(classifyExpression({ ...base, impact: 0.8 })).toBe("squint");
  });

  it("goes wide on fast ascent", () => {
    expect(classifyExpression({ ...base, vy: 25 })).toBe("wide");
  });

  it("tears up when falling far", () => {
    expect(classifyExpression({ ...base, vy: -20, fallDepth: 20 })).toBe("tear");
  });

  it("tear outranks squint when both apply", () => {
    expect(classifyExpression({ vy: -20, impact: 0.9, fallDepth: 20, airborne: true })).toBe(
      "tear",
    );
  });
});

describe("eyeShape", () => {
  it("idle is fully open", () => {
    expect(eyeShape("idle").openY).toBe(1);
  });

  it("squint reduces vertical opening", () => {
    expect(eyeShape("squint").openY).toBeLessThan(1);
  });

  it("wide enlarges scale and pupil", () => {
    const s = eyeShape("wide");
    expect(s.scale).toBeGreaterThan(1);
    expect(s.pupil).toBeGreaterThan(1);
  });

  it("tear sets a tear amount", () => {
    expect(eyeShape("tear").tear).toBe(1);
  });

  it("blink closes the eyes regardless of expression", () => {
    expect(eyeShape("wide", 1).openY).toBeCloseTo(0, 5);
  });
});
