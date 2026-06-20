import { afterEach, describe, expect, it } from "vitest";
import {
  consumeAirNudge,
  consumeBlobSplits,
  consumeCloudAdherence,
  consumeImpact,
  consumeLanding,
  consumeLaunch,
  consumeLaunchBursts,
  consumeMidAirBounce,
  consumeRouteGateHit,
  consumeSplats,
  consumeTeleport,
  getAim,
  getAirSteer,
  getBlobFaceFocusTarget,
  reportBlobSplit,
  reportCloudAdherence,
  reportImpact,
  reportLanding,
  reportLaunchBurst,
  reportRouteGateHit,
  reportSplat,
  requestAirNudge,
  requestLaunch,
  requestMidAirBounce,
  requestTeleport,
  resetBridges,
  setAim,
  setAirSteer,
  setBlobFaceFocusTarget,
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

  it("stores + consumes an air nudge once (the caller pre-normalises the direction)", () => {
    requestAirNudge(1, 0);
    expect(consumeAirNudge()).toEqual([1, 0]);
    expect(consumeAirNudge()).toBeNull();
  });

  it("consumes a cloud-adherence request once", () => {
    reportCloudAdherence({
      padId: 3,
      type: "standard",
      position: [0, 0, 0],
      settleY: 1.2,
      relX: 0.1,
      relZ: -0.2,
      strength: 0.7,
    });
    expect(consumeCloudAdherence()?.padId).toBe(3);
    expect(consumeCloudAdherence()).toBeNull();
  });
});

describe("launchBridge queues + persistent state", () => {
  it("carries a death-strength (1.0) splat through the queue (the climactic game-over splat)", () => {
    // PlayerBlob reports a full-strength splat on death so the most dramatic moment gets the biggest
    // goo burst. Verify the bridge carries strength 1 intact (the renderer scales the burst by it).
    reportSplat({ position: [3, -2, 1], strength: 1 });
    const [death] = consumeSplats();
    expect(death.strength).toBe(1);
    expect(death.position).toEqual([3, -2, 1]);
  });

  it("drains the splat/burst/split queues and clears them", () => {
    reportSplat({ position: [0, 0, 0], strength: 0.5 });
    reportSplat({ position: [1, 0, 0], strength: 0.8 });
    expect(consumeSplats()).toHaveLength(2);
    expect(consumeSplats()).toHaveLength(0);

    reportLaunchBurst({ position: [0, 0, 0], charge: 1, kind: "launch" });
    expect(consumeLaunchBursts()).toHaveLength(1);
    expect(consumeLaunchBursts()).toHaveLength(0);
  });

  it("caps the blob-split queue at its retained tail (the most recent 4)", () => {
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
    // Exactly the last 4 are retained (x = 4..7); the oldest are dropped.
    const out = consumeBlobSplits();
    expect(out).toHaveLength(4);
    expect(out.map((e) => e.position[0])).toEqual([4, 5, 6, 7]);
  });

  it("aim + air-steer + blob-face-focus are persistent getters (not one-shot)", () => {
    setAim({ dir: [0, 1, 0], charge: 0.6 });
    expect(getAim()?.charge).toBe(0.6);
    expect(getAim()?.charge).toBe(0.6); // still there — it's live state, not consumed
    setAim(null);
    expect(getAim()).toBeNull();

    setAirSteer(0.5, -0.3);
    expect(getAirSteer()).toEqual([0.5, -0.3]);
    expect(getAirSteer()).toEqual([0.5, -0.3]);

    setBlobFaceFocusTarget({ kind: "routeEndpoint", position: [1, 2, 3], intensity: 0.8 });
    expect(getBlobFaceFocusTarget()?.intensity).toBe(0.8);
    expect(getBlobFaceFocusTarget()?.intensity).toBe(0.8); // persistent, not consumed
    setBlobFaceFocusTarget(null);
    expect(getBlobFaceFocusTarget()).toBeNull();
  });
});

describe("resetBridges", () => {
  it("clears every pending bridge value so a value can't leak into the next run", () => {
    requestLaunch({ dir: [0, 1, 0], charge: 1 });
    reportImpact(9);
    requestAirNudge(1, 0);
    requestTeleport(600);
    reportSplat({ position: [0, 0, 0], strength: 1 });
    setAim({ dir: [0, 1, 0], charge: 1 });
    setAirSteer(1, 1);
    setBlobFaceFocusTarget({ kind: "slicer", position: [0, 0, 0], intensity: 1 });
    reportCloudAdherence({
      padId: 1,
      type: "standard",
      position: [0, 0, 0],
      settleY: 1,
      relX: 0,
      relZ: 0,
      strength: 1,
    });
    requestMidAirBounce();

    resetBridges();

    expect(consumeLaunch()).toBeNull();
    expect(consumeImpact()).toBe(0);
    expect(consumeAirNudge()).toBeNull();
    expect(consumeTeleport()).toBeNull();
    expect(consumeSplats()).toHaveLength(0);
    expect(getAim()).toBeNull();
    expect(getAirSteer()).toEqual([0, 0]);
    expect(getBlobFaceFocusTarget()).toBeNull();
    expect(consumeCloudAdherence()).toBeNull();
    expect(consumeMidAirBounce()).toBe(false);
  });
});
