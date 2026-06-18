import { describe, expect, it } from "vitest";
import { cloudCatch } from "../catch";

const pad = {
  padPosition: [0, 10, 0] as const,
  width: 8,
  depth: 6,
};

describe("cloudCatch", () => {
  it("lets Blobby pass upward through a cloud underside", () => {
    expect(
      cloudCatch({
        ...pad,
        blobPosition: [0, 10.8, 0],
        blobVelocity: [0, 8, 0],
      }),
    ).toBeNull();
  });

  it("catches a descending blob inside the cloud footprint", () => {
    const hit = cloudCatch({
      ...pad,
      blobPosition: [1, 11.25, 0.5],
      blobVelocity: [0, -4, 0],
    });

    expect(hit).not.toBeNull();
    expect(hit?.speed).toBe(4);
    expect(hit?.settleY).toBeGreaterThan(pad.padPosition[1]);
    expect(hit?.relX).toBeCloseTo(0.125);
  });

  it("rejects misses outside the cloud footprint", () => {
    expect(
      cloudCatch({
        ...pad,
        blobPosition: [8, 11.25, 0],
        blobVelocity: [0, -4, 0],
      }),
    ).toBeNull();
  });
});
