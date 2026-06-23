import { describe, expect, it } from "vitest";
import { projectTrajectory } from "../trajectory";

const G: [number, number, number] = [0, -30, 0];

describe("projectTrajectory", () => {
  it("starts at the blob's current position", () => {
    const pts = projectTrajectory({
      position: [1, 5, 2],
      velocity: [0, 10, 0],
      steer: [0, 0],
      gravity: G,
    });
    expect(pts[0]).toEqual([1, 5, 2]);
  });

  it("a purely vertical launch stays on the launch column (no lateral drift)", () => {
    const pts = projectTrajectory({
      position: [0, 0, 0],
      velocity: [0, 12, 0],
      steer: [0, 0],
      gravity: G,
    });
    for (const [x, , z] of pts) {
      expect(Math.abs(x)).toBeLessThan(1e-9);
      expect(Math.abs(z)).toBeLessThan(1e-9);
    }
  });

  it("rises then falls under gravity (the apex is the highest sample)", () => {
    const pts = projectTrajectory(
      { position: [0, 0, 0], velocity: [0, 20, 0], steer: [0, 0], gravity: G },
      { maxDrop: 5 },
    );
    const ys = pts.map((p) => p[1]);
    const apex = Math.max(...ys);
    expect(apex).toBeGreaterThan(0);
    expect(ys[ys.length - 1]).toBeLessThan(apex);
  });

  it("RIGHT steer bends the path toward +X — the arc shows where steering leads", () => {
    const base = projectTrajectory(
      { position: [0, 0, 0], velocity: [0, 20, 0], steer: [0, 0], gravity: G },
      { maxDrop: 5 },
    );
    const steered = projectTrajectory(
      { position: [0, 0, 0], velocity: [0, 20, 0], steer: [15, 0], gravity: G },
      { maxDrop: 5 },
    );
    // The steered arc ends measurably further along +X than the un-steered one.
    expect(steered[steered.length - 1][0]).toBeGreaterThan(base[base.length - 1][0] + 0.5);
  });

  it("stops once it has dropped maxDrop below the launch height", () => {
    const pts = projectTrajectory(
      { position: [0, 100, 0], velocity: [0, 0, 0], steer: [0, 0], gravity: G },
      { maxDrop: 10, maxPoints: 1000 },
    );
    const lastY = pts[pts.length - 1][1];
    // It cuts off near the maxDrop boundary, not at the full maxPoints fall.
    expect(100 - lastY).toBeGreaterThanOrEqual(10);
    expect(100 - lastY).toBeLessThan(15);
  });

  it("never emits more than maxPoints", () => {
    const pts = projectTrajectory(
      { position: [0, 0, 0], velocity: [0, 50, 0], steer: [0, 0], gravity: G },
      { maxPoints: 20, maxDrop: 100000 },
    );
    expect(pts.length).toBeLessThanOrEqual(20);
  });
});
