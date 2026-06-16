import { describe, expect, it } from "vitest";
import { computeAim, computeAirSteer, keyboardSteer } from "../intents";

describe("computeAim (slingshot)", () => {
  it("strength scales with drag distance and clamps at 1", () => {
    expect(computeAim(0, 0).strength).toBe(0);
    expect(computeAim(70, 0).strength).toBeCloseTo(0.5, 5);
    expect(computeAim(140, 0).strength).toBe(1);
    expect(computeAim(400, 0).strength).toBe(1);
  });

  it("applies sensitivity", () => {
    expect(computeAim(70, 0, { maxDragDist: 140, sensitivity: 2 }).strength).toBe(1);
  });

  it("always launches upward (positive Y)", () => {
    for (const [dx, dy] of [
      [0, 100],
      [100, 0],
      [-80, -60],
      [50, -120],
    ]) {
      expect(computeAim(dx, dy).dir[1]).toBeGreaterThan(0);
    }
  });

  it("returns a unit-length direction", () => {
    const { dir } = computeAim(120, -40);
    expect(Math.hypot(dir[0], dir[1], dir[2])).toBeCloseTo(1, 5);
  });

  it("pulling right launches left (slingshot inversion on X)", () => {
    expect(computeAim(100, 0).dir[0]).toBeLessThan(0);
    expect(computeAim(-100, 0).dir[0]).toBeGreaterThan(0);
  });
});

describe("computeAirSteer", () => {
  it("is zero inside the deadzone", () => {
    expect(computeAirSteer(2, 2)).toEqual([0, 0]);
  });

  it("drag right steers +X, drag left steers -X", () => {
    expect(computeAirSteer(90, 0)[0]).toBeGreaterThan(0);
    expect(computeAirSteer(-90, 0)[0]).toBeLessThan(0);
  });

  it("drag up steers forward (-Z), drag down steers backward (+Z)", () => {
    expect(computeAirSteer(0, -90)[1]).toBeLessThan(0);
    expect(computeAirSteer(0, 90)[1]).toBeGreaterThan(0);
  });

  it("magnitude clamps to maxAirAccel", () => {
    const [x, z] = computeAirSteer(500, 0);
    expect(Math.hypot(x, z)).toBeCloseTo(15, 5);
  });

  it("eased response gives finer control near the deadzone than a linear ramp would", () => {
    // A small drag just past the deadzone produces well under half the max accel (the curve),
    // so a player can micro-adjust onto a near pad without overshooting.
    const cfg = { maxSteerDist: 90, deadzone: 8, maxAirAccel: 15, responseCurve: 1.7 };
    const mid = Math.hypot(...computeAirSteer((90 - 8) * 0.5 + 8, 0, cfg));
    expect(mid).toBeLessThan(15 * 0.5);
    expect(mid).toBeGreaterThan(0);
  });

  it("is monotonic — more drag never reduces the steer force", () => {
    let prev = -1;
    for (let d = 9; d <= 200; d += 10) {
      const mag = Math.hypot(...computeAirSteer(d, 0));
      expect(mag).toBeGreaterThanOrEqual(prev);
      prev = mag;
    }
  });

  it("linear responseCurve reproduces a straight ramp", () => {
    const cfg = { maxSteerDist: 90, deadzone: 0, maxAirAccel: 15, responseCurve: 1 };
    expect(Math.hypot(...computeAirSteer(45, 0, cfg))).toBeCloseTo(7.5, 5);
  });
});

describe("keyboardSteer", () => {
  const none = { left: false, right: false, up: false, down: false };

  it("no keys → no force", () => {
    expect(keyboardSteer(none)).toEqual([0, 0]);
  });

  it("opposite keys cancel", () => {
    expect(keyboardSteer({ ...none, left: true, right: true })).toEqual([0, 0]);
  });

  it("diagonals are normalized to maxAirAccel", () => {
    const [x, z] = keyboardSteer({ ...none, right: true, down: true });
    expect(Math.hypot(x, z)).toBeCloseTo(15, 5);
  });
});
