import { createWorld } from "koota";
import { describe, expect, it } from "vitest";
import { Blob, Transform, Velocity } from "@/ecs";
import { spawnBlob } from "../blob";

describe("spawnBlob factory", () => {
  it("spawns a live blob entity with Transform, Velocity and Blob traits", () => {
    const world = createWorld();
    const e = spawnBlob(world, 0.85);
    expect(e.isAlive()).toBe(true);
    expect(e.has(Transform)).toBe(true);
    expect(e.has(Velocity)).toBe(true);
    expect(e.has(Blob)).toBe(true);
    expect(e.get(Blob)?.radius).toBe(0.85);
    expect(e.get(Transform)).toMatchObject({ x: 0, y: 3, z: 0 });
  });
});
