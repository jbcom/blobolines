import { describe, expect, it } from "vitest";
import {
  aimAssistDifficulty,
  aimEndpointHitsStep,
  aimEndpointTargetY,
  showsAimEndpointReticle,
  showsAimParabola,
  solveAimEndpoint,
} from "../TrajectoryPreview";

describe("TrajectoryPreview aim assistance", () => {
  it("keeps endpoint reticles at every difficulty", () => {
    expect(showsAimEndpointReticle("ready")).toBe(true);
    expect(showsAimEndpointReticle("medium")).toBe(true);
    expect(showsAimEndpointReticle("hard")).toBe(true);
    expect(showsAimEndpointReticle("blobmare")).toBe(true);
    expect(showsAimEndpointReticle("ultraBlobmare")).toBe(true);
    expect(showsAimEndpointReticle("oneWrongMove")).toBe(true);
  });

  it("keeps the parabola overlay at every difficulty", () => {
    expect(showsAimParabola("ready")).toBe(true);
    expect(showsAimParabola("medium")).toBe(true);
    expect(showsAimParabola("hard")).toBe(true);
    expect(showsAimParabola("blobmare")).toBe(true);
    expect(showsAimParabola("ultraBlobmare")).toBe(true);
    expect(showsAimParabola("oneWrongMove")).toBe(true);
  });

  it("uses the active progressed difficulty for aim assistance", () => {
    expect(aimAssistDifficulty("ready", 60, 80)).toBe("ready");
    expect(aimAssistDifficulty("ready", 580, 590)).toBe("medium");
    expect(aimAssistDifficulty("ready", 1600, 1700)).toBe("hard");
    expect(aimAssistDifficulty("ready", 100, 5800)).toBe("oneWrongMove");
  });

  it("places the aim endpoint on the descending crossing of the target height", () => {
    const endpoint = solveAimEndpoint([0, 1, 0], [3, 15, -2], 5, -22);

    expect(endpoint).not.toBeNull();
    expect(endpoint?.position[1]).toBe(5);
    expect(endpoint?.position[0]).toBeGreaterThan(0);
    expect(endpoint?.position[2]).toBeLessThan(0);
    expect(endpoint?.time).toBeGreaterThan(15 / 22);
  });

  it("only treats an endpoint as target-valid when it lands inside the next trampoline", () => {
    const step = {
      source: null,
      target: { id: 2, position: [4, 10, -2], width: 6, depth: 4, type: "standard" as const },
      proof: null,
    };

    expect(aimEndpointHitsStep(step, { position: [6.9, 10, -3.9], time: 1 })).toBe(true);
    expect(aimEndpointHitsStep(step, { position: [7.2, 10, -3.9], time: 1 })).toBe(false);
    expect(aimEndpointHitsStep(step, { position: [6.9, 10, 0.2], time: 1 })).toBe(false);
  });

  it("cuts the aim endpoint to the slicer height when the route has a slicer gate", () => {
    expect(
      aimEndpointTargetY({
        source: null,
        target: { id: 2, position: [0, 10, 0], width: 5, depth: 5, type: "standard" },
        proof: {
          toPadId: 2,
          launchNormal: [0, 1, 0],
          launchSpeed: 20,
          launchCharge: 0.8,
          flightTime: 1,
          apex: [0, 12, 0],
          landing: [0, 10, 0],
          clearance: 1,
          samples: [
            [0, 0, 0],
            [0, 6, 0],
            [0, 10, 0],
          ],
          requiredCant: false,
          sourceMode: "flat",
          launchAngleRad: 0,
          landingPrecision: 1,
          lipClearance: 1,
          lipClearanceRatio: 0.2,
          arcCompression: 0,
          routeGate: {
            id: "slicer-test",
            kind: "slicer",
            sourcePadId: 1,
            targetPadId: 2,
            routeIndex: 6,
            sampleIndex: 1,
            position: [0, 6, 0],
            normal: [0, 0, 1],
            radius: 1.5,
            period: 0,
            openFraction: 0,
            phaseOffset: 0,
            flightTime: 0.5,
            idealReleaseDelay: 0,
            fragmentCount: 4,
            splitSpread: 3,
          },
        },
      }),
    ).toBe(6);
  });
});
