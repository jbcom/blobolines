import { describe, expect, it } from "vitest";
import {
  aimAssistDifficulty,
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
});
