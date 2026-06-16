import { describe, expect, it } from "vitest";
import type { Vec3 } from "@/core/types";
import { MERGE_RADIUS, selectMerges } from "../merge";

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
