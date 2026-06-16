import { describe, expect, it } from "vitest";
import type { Vec3 } from "@/core/types";
import { collectedIndices, MAGNET_PULL_SPEED, magnetStep, PICKUP_RADIUS } from "../collect";

describe("collectedIndices", () => {
  const blob: Vec3 = [0, 0, 0];

  it("collects crystals within pickup radius", () => {
    const crystals: Vec3[] = [
      [0, 0, 0], // on top
      [PICKUP_RADIUS - 0.1, 0, 0], // just inside
      [PICKUP_RADIUS + 0.5, 0, 0], // outside
    ];
    expect(collectedIndices(blob, crystals)).toEqual([0, 1]);
  });

  it("collects nothing when all are far", () => {
    expect(collectedIndices(blob, [[50, 0, 0]] as Vec3[])).toEqual([]);
  });
});

describe("magnetStep", () => {
  const blob: Vec3 = [0, 0, 0];

  it("leaves distant crystals unchanged", () => {
    const c: Vec3 = [100, 0, 0];
    expect(magnetStep(blob, c, 1 / 60)).toEqual(c);
  });

  it("pulls nearby crystals toward the blob", () => {
    const c: Vec3 = [5, 0, 0];
    const moved = magnetStep(blob, c, 1 / 60);
    expect(moved[0]).toBeLessThan(c[0]);
    expect(moved[0]).toBeGreaterThan(0);
  });

  it("never overshoots the blob", () => {
    const c: Vec3 = [0.01, 0, 0];
    const moved = magnetStep(blob, c, 1); // huge dt
    // distance to blob should not flip past origin
    expect(Math.abs(moved[0])).toBeLessThanOrEqual(0.01);
  });

  it("pull magnitude respects MAGNET_PULL_SPEED", () => {
    const c: Vec3 = [10, 0, 0];
    const dt = 0.1;
    const moved = magnetStep(blob, c, dt);
    expect(c[0] - moved[0]).toBeCloseTo(MAGNET_PULL_SPEED * dt, 5);
  });
});
