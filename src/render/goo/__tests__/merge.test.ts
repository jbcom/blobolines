import { describe, expect, it } from "vitest";
import type { Vec3 } from "@/core/types";
import { bridgeFor, MERGE_RADIUS, selectMerges } from "../merge";

describe("selectMerges", () => {
  const blob: Vec3 = [0, 0, 0];
  const radius = 0.85;

  it("selects only droplets within merge range", () => {
    const range = radius + MERGE_RADIUS;
    const droplets: Vec3[] = [
      [0, 0, 0], // overlapping
      [range - 0.1, 0, 0], // just inside
      [range + 1, 0, 0], // outside
    ];
    const merges = selectMerges(blob, radius, droplets);
    expect(merges.map((m) => m.index).sort()).toEqual([0, 1]);
  });

  it("weights closer droplets higher (0..1)", () => {
    const droplets: Vec3[] = [
      [0, 0, 0],
      [3, 0, 0],
    ];
    const merges = selectMerges(blob, radius, droplets);
    const near = merges.find((m) => m.index === 0)!;
    const far = merges.find((m) => m.index === 1);
    expect(near.weight).toBeGreaterThan(0);
    expect(near.weight).toBeLessThanOrEqual(1);
    if (far) expect(near.weight).toBeGreaterThan(far.weight);
  });

  it("returns nearest-first and caps to maxMerges", () => {
    const droplets: Vec3[] = Array.from({ length: 20 }, (_, i) => [i * 0.1, 0, 0] as Vec3);
    const merges = selectMerges(blob, radius, droplets, 6);
    expect(merges.length).toBe(6);
    // descending weight = ascending distance
    for (let i = 1; i < merges.length; i++) {
      expect(merges[i].weight).toBeLessThanOrEqual(merges[i - 1].weight);
    }
  });

  it("returns empty when nothing is near", () => {
    expect(selectMerges(blob, radius, [[100, 0, 0]] as Vec3[])).toEqual([]);
  });
});

describe("bridgeFor (goo neck)", () => {
  const blob: Vec3 = [0, 0, 0];
  const blobR = 0.85;
  const dropR = 0.3;

  it("returns null when the droplet overlaps the blob (no gap to bridge)", () => {
    // Surfaces touching/overlapping → spheres already fuse, no separate neck.
    expect(bridgeFor(blob, blobR, [blobR, 0, 0], dropR)).toBeNull();
  });

  it("returns null when the droplet is beyond the pinch-off range", () => {
    const farGap = blobR + dropR + MERGE_RADIUS + 0.5;
    expect(bridgeFor(blob, blobR, [farGap, 0, 0], dropR)).toBeNull();
  });

  it("returns null for a coincident droplet (no axis)", () => {
    expect(bridgeFor(blob, blobR, [0, 0, 0], dropR)).toBeNull();
  });

  it("bridges a separating droplet with a unit axis pointing at it", () => {
    const gap = 0.6; // surface-to-surface gap inside the merge window
    const at: Vec3 = [blobR + dropR + gap, 0, 0];
    const b = bridgeFor(blob, blobR, at, dropR);
    expect(b).not.toBeNull();
    if (b) {
      expect(b.axis).toEqual([1, 0, 0]);
      expect(Math.hypot(...b.axis)).toBeCloseTo(1, 5);
      // Half-length spans half the surface gap; midpoint sits between the two surfaces.
      expect(b.halfLength).toBeCloseTo(gap / 2, 5);
      expect(b.midpoint[0]).toBeCloseTo(blobR + gap / 2, 5);
    }
  });

  it("thins the neck as the gap widens (teardrop pinch)", () => {
    const near = bridgeFor(blob, blobR, [blobR + dropR + 0.2, 0, 0], dropR);
    const far = bridgeFor(blob, blobR, [blobR + dropR + 2.0, 0, 0], dropR);
    expect(near).not.toBeNull();
    expect(far).not.toBeNull();
    if (near && far) expect(near.radius).toBeGreaterThan(far.radius);
  });

  it("scales neck thickness with droplet size", () => {
    const at: Vec3 = [blobR + 0.5 + 0.4, 0, 0]; // same gap for both
    const small = bridgeFor(blob, blobR, at, 0.2);
    const big = bridgeFor(blob, blobR, [blobR + 0.8 + 0.4, 0, 0], 0.8);
    expect(small).not.toBeNull();
    expect(big).not.toBeNull();
    if (small && big) expect(big.radius).toBeGreaterThan(small.radius);
  });
});
