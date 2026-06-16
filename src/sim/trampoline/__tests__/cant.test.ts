import { describe, expect, it } from "vitest";
import { cantEuler, cantNormal } from "../cant";

describe("cantNormal", () => {
  it("flat (no cant) points straight up", () => {
    expect(cantNormal(undefined)).toEqual([0, 1, 0]);
    expect(cantNormal([0, 0])).toEqual([0, 1, 0]);
  });

  it("leans toward the cant direction with a positive y", () => {
    const n = cantNormal([1, 0], Math.PI / 6); // 30° toward +x
    expect(n[0]).toBeCloseTo(Math.sin(Math.PI / 6), 5); // 0.5
    expect(n[1]).toBeCloseTo(Math.cos(Math.PI / 6), 5);
    expect(n[2]).toBeCloseTo(0, 5);
    // Still a unit vector and still mostly up.
    expect(Math.hypot(n[0], n[1], n[2])).toBeCloseTo(1, 5);
    expect(n[1]).toBeGreaterThan(0.7);
  });

  it("normalizes a non-unit cant direction", () => {
    const n = cantNormal([3, 4], Math.PI / 4); // dir normalizes to [0.6,0.8]
    const s = Math.sin(Math.PI / 4);
    expect(n[0]).toBeCloseTo(s * 0.6, 5);
    expect(n[2]).toBeCloseTo(s * 0.8, 5);
  });
});

describe("cantEuler", () => {
  it("flat tilt is zero", () => {
    expect(cantEuler(undefined)).toEqual({ rotX: 0, rotZ: 0 });
  });

  it("toward +x is a negative Z rotation; toward +z a positive X rotation", () => {
    const tilt = 0.4;
    const x = cantEuler([1, 0], tilt);
    expect(x.rotZ).toBeCloseTo(-tilt, 5);
    expect(x.rotX).toBeCloseTo(0, 5);
    const z = cantEuler([0, 1], tilt);
    expect(z.rotX).toBeCloseTo(tilt, 5);
    expect(z.rotZ).toBeCloseTo(0, 5);
  });
});
