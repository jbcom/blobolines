import { afterEach, describe, expect, it } from "vitest";
import {
  consumeAirNudge,
  consumeBlobSplits,
  consumeImpact,
  consumeLanding,
  consumeLaunch,
  consumeLaunchBursts,
  consumeMidAirBounce,
  consumeRouteGateHit,
  consumeSplats,
  getAim,
  getAirSteer,
  reportBlobSplit,
  reportImpact,
  reportLanding,
  reportLaunchBurst,
  reportRouteGateHit,
  reportSplat,
  requestAirNudge,
  requestLaunch,
  requestMidAirBounce,
  resetBridges,
  setAim,
  setAirSteer,
} from "../launchBridge";

afterEach(() => resetBridges());

describe("launchBridge request/consume contracts", () => {
  it("consumes a launch request exactly once", () => {
    requestLaunch({ dir: [0, 1, 0], charge: 1 });
    expect(consumeLaunch()).toEqual({ dir: [0, 1, 0], charge: 1 });
    expect(consumeLaunch()).toBeNull();
  });

  it("consumes a route-gate hit once", () => {
    const hit = {
      gateId: "g1",
      kind: "slicer" as const,
      position: [0, 0, 0] as const,
      velocity: [0, 1, 0] as const,
      normal: [0, 1, 0] as const,
      strength: 0.8,
    };
    reportRouteGateHit(hit);
    expect(consumeRouteGateHit()?.gateId).toBe("g1");
    expect(consumeRouteGateHit()).toBeNull();
  });

  it("consumes the strongest landing (not the latest) and clears it", () => {
    reportLanding({ padId: 1, speed: 4, position: [0, 0, 0], relX: 0, relZ: 0 });
    reportLanding({ padId: 2, speed: 9, position: [1, 0, 0], relX: 0, relZ: 0 });
    reportLanding({ padId: 3, speed: 2, position: [2, 0, 0], relX: 0, relZ: 0 });
    expect(consumeLanding()?.padId).toBe(2); // strongest, not the last reported
    expect(consumeLanding()).toBeNull();
  });

  it("keeps the MAX landing impact across reports in a frame", () => {
    reportImpact(3);
    reportImpact(8);
    reportImpact(5);
    expect(consumeImpact()).toBe(8);
    expect(consumeImpact()).toBe(0); // cleared
  });

  it("consumes a mid-air bounce flag once", () => {
    expect(consumeMidAirBounce()).toBe(false);
    requestMidAirBounce();
    expect(consumeMidAirBounce()).toBe(true);
    expect(consumeMidAirBounce()).toBe(false);
  });

  it("normalises + consumes an air nudge once", () => {
    requestAirNudge(1, 0);
    expect(consumeAirNudge()).toEqual([1, 0]);
    expect(consumeAirNudge()).toBeNull();
  });
});

describe("launchBridge queues + persistent state", () => {
  it("drains the splat/burst/split queues and clears them", () => {
    reportSplat({ position: [0, 0, 0], strength: 0.5 });
    reportSplat({ position: [1, 0, 0], strength: 0.8 });
    expect(consumeSplats()).toHaveLength(2);
    expect(consumeSplats()).toHaveLength(0);

    reportLaunchBurst({ position: [0, 0, 0], charge: 1, kind: "launch" });
    expect(consumeLaunchBursts()).toHaveLength(1);
    expect(consumeLaunchBursts()).toHaveLength(0);
  });

  it("caps the blob-split queue at its retained tail", () => {
    for (let i = 0; i < 8; i++) {
      reportBlobSplit({
        position: [i, 0, 0],
        velocity: [0, 0, 0],
        normal: [0, 1, 0],
        count: 3,
        spread: 0.5,
        strength: 1,
      });
    }
    // The queue retains only the recent tail (≤4) — the oldest splits are dropped.
    expect(consumeBlobSplits().length).toBeLessThanOrEqual(4);
  });

  it("aim + air-steer are persistent getters (not one-shot)", () => {
    setAim({ dir: [0, 1, 0], charge: 0.6 });
    expect(getAim()?.charge).toBe(0.6);
    expect(getAim()?.charge).toBe(0.6); // still there — it's live state, not consumed
    setAim(null);
    expect(getAim()).toBeNull();

    setAirSteer(0.5, -0.3);
    expect(getAirSteer()).toEqual([0.5, -0.3]);
    expect(getAirSteer()).toEqual([0.5, -0.3]);
  });
});

describe("resetBridges", () => {
  it("clears every pending bridge value so a value can't leak into the next run", () => {
    requestLaunch({ dir: [0, 1, 0], charge: 1 });
    reportImpact(9);
    requestAirNudge(1, 0);
    reportSplat({ position: [0, 0, 0], strength: 1 });
    setAim({ dir: [0, 1, 0], charge: 1 });
    setAirSteer(1, 1);
    requestMidAirBounce();

    resetBridges();

    expect(consumeLaunch()).toBeNull();
    expect(consumeImpact()).toBe(0);
    expect(consumeAirNudge()).toBeNull();
    expect(consumeSplats()).toHaveLength(0);
    expect(getAim()).toBeNull();
    expect(getAirSteer()).toEqual([0, 0]);
    expect(consumeMidAirBounce()).toBe(false);
  });
});
