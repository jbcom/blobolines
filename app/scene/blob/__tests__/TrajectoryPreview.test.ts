import { describe, expect, it } from "vitest";
import { showsAimEndpointReticle, showsAimParabola, solveAimEndpoint } from "../TrajectoryPreview";

describe("TrajectoryPreview aim assistance", () => {
  it("shows endpoint reticles only before Blobmare", () => {
    expect(showsAimEndpointReticle("ready")).toBe(true);
    expect(showsAimEndpointReticle("medium")).toBe(true);
    expect(showsAimEndpointReticle("hard")).toBe(true);
    expect(showsAimEndpointReticle("blobmare")).toBe(false);
    expect(showsAimEndpointReticle("ultraBlobmare")).toBe(false);
    expect(showsAimEndpointReticle("oneWrongMove")).toBe(false);
  });

  it("removes the parabola overlay for Ultra Blobmare and One Wrong Move", () => {
    expect(showsAimParabola("ready")).toBe(true);
    expect(showsAimParabola("medium")).toBe(true);
    expect(showsAimParabola("hard")).toBe(true);
    expect(showsAimParabola("blobmare")).toBe(true);
    expect(showsAimParabola("ultraBlobmare")).toBe(false);
    expect(showsAimParabola("oneWrongMove")).toBe(false);
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
