import { describe, expect, it } from "vitest";
import type { GoldenPathProof, RouteGateSpec, TrampolineSpec } from "@/core/types";
import { routeProfile } from "../difficulty";
import { createRouteGateForProof, routeGatePhase } from "../routeGate";

function gate(overrides: Partial<RouteGateSpec> = {}): RouteGateSpec {
  return {
    id: "gate-test",
    kind: "phasePortal",
    sourcePadId: 1,
    targetPadId: 2,
    routeIndex: 5,
    sampleIndex: 1,
    position: [0, 0, 0],
    normal: [0, 0, 1],
    radius: 1.5,
    period: 1,
    openFraction: 0.4,
    phaseOffset: 0,
    flightTime: 0.5,
    idealReleaseDelay: 0,
    ...overrides,
  };
}

function pad(id: number, routeIndex: number, y = 0): TrampolineSpec {
  return {
    id,
    routeIndex,
    position: [0, y, 0],
    width: 5,
    depth: 5,
    type: "standard",
  };
}

function proof(samples: GoldenPathProof["samples"]): GoldenPathProof {
  return {
    toPadId: 2,
    launchNormal: [0, 1, 0],
    launchSpeed: 20,
    launchCharge: 0.8,
    flightTime: 1,
    apex: [0, 4, 0],
    landing: [0, 1, 0],
    clearance: 1,
    samples,
    requiredCant: false,
    sourceMode: "flat",
    launchAngleRad: 0,
    landingPrecision: 1,
    lipClearance: 1,
    lipClearanceRatio: 0.2,
    arcCompression: 0,
    variants: [],
  };
}

describe("route gates", () => {
  it("wraps negative phase offsets into the visible cycle", () => {
    expect(routeGatePhase(gate({ phaseOffset: -0.25 }), 0)).toBeCloseTo(0.75);
    expect(routeGatePhase(gate({ phaseOffset: -1.25 }), 0)).toBeCloseTo(0.75);
  });

  it("does not create a gate when the proof has too few samples to time safely", () => {
    const created = createRouteGateForProof(
      pad(1, 5),
      pad(2, 6, 8),
      proof([[0, 0, 0]]),
      routeProfile("ultraBlobmare"),
    );

    expect(created).toBeNull();
  });

  it("creates proof-anchored slicers in Blobmare", () => {
    const samples: GoldenPathProof["samples"] = [
      [0, 0, 0],
      [0, 1, 0],
      [0, 2, 0],
      [0, 3, 0],
      [0, 4, 0],
      [0, 5, 0],
      [0, 6, 0],
      [0, 7, 0],
      [0, 8, 0],
    ];
    const created = createRouteGateForProof(
      pad(1, 6),
      pad(2, 7, 8),
      proof(samples),
      routeProfile("blobmare"),
    );

    expect(created?.kind).toBe("slicer");
    expect(created?.period).toBe(0);
    expect(created?.fragmentCount).toBeGreaterThanOrEqual(3);
    expect(created?.fragmentCount).toBeLessThanOrEqual(5);
    expect(created?.position).toEqual(samples[created?.sampleIndex ?? -1]);
    expect(created?.fragmentLanes).toHaveLength(created?.fragmentCount);
    expect(created?.fragmentLanes?.some((lane) => lane.survivor)).toBe(true);
    const survivor = created?.fragmentLanes?.find((lane) => lane.survivor);
    expect(survivor?.samples[0]).toEqual(created?.position);
    expect(survivor?.landingPrecision).toBeGreaterThan(0);
    expect(survivor?.exitVelocity.every(Number.isFinite)).toBe(true);
  });
});
