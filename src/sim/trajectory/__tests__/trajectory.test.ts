import { describe, expect, it } from "vitest";
import { projectTrajectory, shouldSettleLateral } from "../trajectory";

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

  it("clamps degenerate options instead of producing runaway/empty output", () => {
    // step <= 0 would never advance the integration → falls back to the default step.
    const zeroStep = projectTrajectory(
      { position: [0, 0, 0], velocity: [0, 20, 0], steer: [0, 0], gravity: G },
      { step: 0, maxDrop: 5 },
    );
    expect(zeroStep.length).toBeGreaterThan(1);
    expect(zeroStep[1][1]).not.toBe(0); // it actually moved (default step kicked in)

    // maxPoints < 1 still yields at least the start point, never a runaway or empty array.
    const tinyCap = projectTrajectory(
      { position: [1, 2, 3], velocity: [0, 20, 0], steer: [0, 0], gravity: G },
      { maxPoints: 0 },
    );
    expect(tinyCap.length).toBeGreaterThanOrEqual(1);
    expect(tinyCap[0]).toEqual([1, 2, 3]);
  });
});

describe("shouldSettleLateral", () => {
  // The settle must NEVER engage on a purely ballistic hop (launched, never steered) — that would
  // bleed the certified launch's lateral travel and could undershoot a flat-pad offset target,
  // breaking the climb-reach guarantee. It engages ONLY when hands-off AND the player has steered.
  it("does NOT settle a ballistic hop that has never been steered (reachability-safe)", () => {
    expect(shouldSettleLateral(false, false)).toBe(false);
  });

  it("does NOT settle while the player is actively steering (full steer authority preserved)", () => {
    expect(shouldSettleLateral(true, true)).toBe(false);
    expect(shouldSettleLateral(true, false)).toBe(false);
  });

  it("settles ONLY when hands-off after having steered this flight (tidies steering drift)", () => {
    expect(shouldSettleLateral(false, true)).toBe(true);
  });
});
