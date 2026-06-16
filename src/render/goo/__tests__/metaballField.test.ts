import { describe, expect, it } from "vitest";
import type { Vec3 } from "@/core/types";
import { type MetaballSource, packMetaballField } from "../metaballField";

describe("packMetaballField", () => {
  const blobRadius = 0.85;

  it("places the blob metaball at its WORLD position, not the origin", () => {
    // Regression: the shader raymarches in world space, so ball 0 must equal the blob's
    // world position. Packing it at local (0,0,0) pinned the goo to the world origin —
    // the goo rendered on the floor while the eyes floated at the (correct) blob center.
    const blob: Vec3 = [2, 14.5, -3];
    const field = packMetaballField(blob, blobRadius, [], 24);

    expect(field.count).toBe(1);
    expect(field.centers[0]).toEqual([2, 14.5, -3]);
    expect(field.centers[0]).not.toEqual([0, 0, 0]);
    expect(field.radii[0]).toBe(blobRadius);
  });

  it("merges nearby droplets in WORLD space (absolute, not blob-relative)", () => {
    const blob: Vec3 = [10, 10, 10];
    const near: MetaballSource = { position: [11, 10.5, 10], radius: 0.4 }; // ~1.1 away
    const far: MetaballSource = { position: [20, 10, 10], radius: 0.4 }; // 10 away
    const field = packMetaballField(blob, blobRadius, [near, far], 24);

    expect(field.count).toBe(2); // blob + near droplet only
    // The droplet center must be its absolute world position, not an offset from the blob.
    expect(field.centers[1]).toEqual([11, 10.5, 10]);
    expect(field.radii[1]).toBe(0.4);
  });

  it("pinches off a droplet that has dropped below the blob body (no teardrop neck)", () => {
    const blob: Vec3 = [0, 10, 0];
    // Within merge distance horizontally, but clearly below the blob bottom (settling).
    const below: MetaballSource = { position: [0, 10 - (blobRadius + 1), 0], radius: 0.3 };
    const field = packMetaballField(blob, blobRadius, [below], 24);
    expect(field.count).toBe(1); // blob only — the fallen droplet is not bridged in
  });

  it("still merges a close droplet level with / above the blob", () => {
    const blob: Vec3 = [0, 10, 0];
    const above: MetaballSource = { position: [0.3, 10.4, 0], radius: 0.3 };
    const field = packMetaballField(blob, blobRadius, [above], 24);
    expect(field.count).toBe(2);
  });

  it("caps the total ball count at maxBalls", () => {
    const blob: Vec3 = [0, 0, 0];
    const droplets: MetaballSource[] = Array.from({ length: 30 }, (_, i) => ({
      position: [i * 0.01, 0, 0] as Vec3,
      radius: 0.2,
    }));
    const field = packMetaballField(blob, blobRadius, droplets, 8);

    expect(field.count).toBe(8);
    expect(field.centers).toHaveLength(8);
    expect(field.radii).toHaveLength(8);
  });
});
