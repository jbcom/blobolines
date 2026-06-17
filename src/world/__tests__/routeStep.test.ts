import { describe, expect, it } from "vitest";
import type { TrampolineSpec } from "@/core/types";
import { nextRouteStep } from "../routeStep";

const target: TrampolineSpec = {
  id: 8,
  routeIndex: 1,
  position: [4, 8, -3],
  width: 8,
  depth: 8,
  type: "moving",
};

const later: TrampolineSpec = {
  id: 18,
  routeIndex: 2,
  position: [-2, 18, 4],
  width: 7,
  depth: 7,
  type: "canted",
};

const source: TrampolineSpec = {
  id: 0,
  routeIndex: 0,
  position: [0, 0, 0],
  width: 7.5,
  depth: 7.5,
  type: "standard",
  goldenPath: {
    toPadId: target.id,
    launchNormal: [0, 1, 0],
    launchSpeed: 30,
    flightTime: 0.5,
    apex: [0, 9, 0],
    landing: target.position,
    clearance: 2,
    samples: [[0, 0, 0], target.position],
    requiredCant: false,
    sourceMode: "flat",
    launchAngleRad: 0,
    landingPrecision: 1,
    lipClearance: 2,
    lipClearanceRatio: 0.5,
    arcCompression: 0.2,
  },
};

describe("nextRouteStep", () => {
  it("selects the lowest pad above the progression floor even when unordered", () => {
    const step = nextRouteStep(0, [later, source, target]);
    expect(step?.target).toBe(target);
  });

  it("returns the stored golden proof from the source pad", () => {
    const step = nextRouteStep(0, [source, target, later]);
    expect(step?.source).toBe(source);
    expect(step?.proof?.toPadId).toBe(target.id);
  });

  it("returns null when no pad is above the floor", () => {
    expect(nextRouteStep(20, [source, target, later])).toBeNull();
  });
});
