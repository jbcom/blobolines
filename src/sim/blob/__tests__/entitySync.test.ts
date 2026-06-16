import { describe, expect, it } from "vitest";
import { blobTraitsFromSnapshot } from "../entitySync";

describe("blobTraitsFromSnapshot", () => {
  it("maps a diagnostics snapshot to Transform/Velocity/Blob trait values", () => {
    const u = blobTraitsFromSnapshot({
      position: [1, 2, 3],
      velocity: [-4, 5, -6],
      squash: 0.7,
      airborne: false,
      expression: "squint",
    });
    expect(u.transform).toEqual({ x: 1, y: 2, z: 3 });
    expect(u.velocity).toEqual({ x: -4, y: 5, z: -6 });
    expect(u.blob).toEqual({ squash: 0.7, airborne: false, expression: "squint" });
  });

  it("is pure — does not mutate the input arrays", () => {
    const pos: [number, number, number] = [0, 0, 0];
    const vel: [number, number, number] = [0, 0, 0];
    blobTraitsFromSnapshot({
      position: pos,
      velocity: vel,
      squash: 1,
      airborne: true,
      expression: "idle",
    });
    expect(pos).toEqual([0, 0, 0]);
    expect(vel).toEqual([0, 0, 0]);
  });
});
