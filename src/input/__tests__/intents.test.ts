import { describe, expect, it } from "vitest";
import {
  computeAirSteer,
  computeGroundedRouteCharge,
  computeHoldCharge,
  computeRouteAim,
  keyboardSteer,
} from "../intents";

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

describe("computeHoldCharge", () => {
  it("starts empty until the player actually holds or taps", () => {
    expect(computeHoldCharge(0)).toBe(0);
  });

  it("turns a quick tap into a small route thrust", () => {
    expect(computeHoldCharge(0.03)).toBeCloseTo(0.22, 5);
  });

  it("ramps to full charge over the hold window", () => {
    expect(computeHoldCharge(0.575)).toBeCloseTo(0.5, 5);
    expect(computeHoldCharge(1.15)).toBe(1);
    expect(computeHoldCharge(10)).toBe(1);
  });

  it("uses sensitivity as charge rate", () => {
    expect(
      computeHoldCharge(0.575, { fullChargeSeconds: 1.15, tapCharge: 0.22, sensitivity: 2 }),
    ).toBe(1);
  });
});

describe("computeGroundedRouteCharge", () => {
  const cfg = {
    fullChargeSeconds: 1,
    tapCharge: 0.22,
    sensitivity: 1,
    autoDischargeSeconds: 0.5,
    dragDischargePx: 100,
    cancelDragPx: 80,
  };

  it("ramps like hold charge before full power", () => {
    const result = computeGroundedRouteCharge(
      { heldSeconds: 0.5, dragY: 0, releasing: false, tapEligible: false, wasCharged: false },
      cfg,
    );

    expect(result.charge).toBeCloseTo(0.5, 5);
    expect(result.cancelled).toBe(false);
  });

  it("discharges back to zero after the player overholds max charge", () => {
    const result = computeGroundedRouteCharge(
      { heldSeconds: 1.5, dragY: 0, releasing: false, tapEligible: false, wasCharged: true },
      cfg,
    );

    expect(result.charge).toBe(0);
    expect(result.discharged).toBe(true);
  });

  it("lets the held finger scrub charge back down without cancelling", () => {
    const result = computeGroundedRouteCharge(
      { heldSeconds: 0.9, dragY: 45, releasing: false, tapEligible: false, wasCharged: true },
      cfg,
    );

    expect(result.charge).toBeCloseTo(0.45, 5);
    expect(result.scrubbed).toBe(true);
    expect(result.cancelled).toBe(false);
  });

  it("cancels when the held finger is pulled below the blob", () => {
    const result = computeGroundedRouteCharge(
      { heldSeconds: 0.4, dragY: 90, releasing: false, tapEligible: false, wasCharged: true },
      cfg,
    );

    expect(result.charge).toBe(0);
    expect(result.cancelled).toBe(true);
  });

  it("keeps quick tap release as a small route pop", () => {
    const result = computeGroundedRouteCharge(
      { heldSeconds: 0, dragY: 0, releasing: true, tapEligible: true, wasCharged: false },
      cfg,
    );

    expect(result.charge).toBeCloseTo(0.22, 5);
  });

  it("does not turn a fully discharged hold into a tap launch on release", () => {
    const result = computeGroundedRouteCharge(
      { heldSeconds: 1.6, dragY: 0, releasing: true, tapEligible: true, wasCharged: true },
      cfg,
    );

    expect(result.charge).toBe(0);
    expect(result.discharged).toBe(true);
  });
});

describe("computeRouteAim", () => {
  it("points toward the next pad bearing without swipe input", () => {
    expect(computeRouteAim(5, 0, 0.8)[0]).toBeGreaterThan(0);
    expect(computeRouteAim(-5, 0, 0.8)[0]).toBeLessThan(0);
    expect(computeRouteAim(0, 5, 0.8)[2]).toBeGreaterThan(0);
  });

  it("keeps low charge more vertical and high charge more lateral", () => {
    const low = computeRouteAim(5, 0, 0.25);
    const high = computeRouteAim(5, 0, 0.9);
    expect(low[1]).toBeGreaterThan(high[1]);
    expect(Math.abs(high[0])).toBeGreaterThan(Math.abs(low[0]));
    expect(Math.hypot(...high)).toBeCloseTo(1, 5);
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
