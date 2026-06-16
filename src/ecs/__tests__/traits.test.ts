import { createWorld } from "koota";
import { beforeEach, describe, expect, it } from "vitest";
import { Blob, Crystal, Particle, Trampoline, Transform, Velocity } from "../traits";

describe("ecs traits", () => {
  let world: ReturnType<typeof createWorld>;

  beforeEach(() => {
    world = createWorld();
  });

  it("spawns a blob with transform + velocity and queries it", () => {
    const e = world.spawn(Transform({ x: 0, y: 5, z: 0 }), Velocity, Blob);
    expect(e.has(Blob)).toBe(true);
    expect(e.get(Transform)?.y).toBe(5);

    const blobs = world.query(Blob, Transform);
    expect(blobs.length).toBe(1);
  });

  it("uses trait defaults when not overridden", () => {
    const e = world.spawn(Blob);
    expect(e.get(Blob)?.radius).toBeCloseTo(0.85);
    expect(e.get(Blob)?.airborne).toBe(true);
    expect(e.get(Blob)?.expression).toBe("idle");
  });

  it("mutates trait values", () => {
    const e = world.spawn(Trampoline({ type: "booster", width: 7 }));
    expect(e.get(Trampoline)?.type).toBe("booster");
    e.set(Trampoline, { ...e.get(Trampoline)!, depress: -2 });
    expect(e.get(Trampoline)?.depress).toBe(-2);
  });

  it("queries by trait composition independently", () => {
    world.spawn(Transform, Crystal);
    world.spawn(Transform, Particle);
    world.spawn(Transform, Blob);
    expect(world.query(Crystal).length).toBe(1);
    expect(world.query(Particle).length).toBe(1);
    expect(world.query(Transform).length).toBe(3);
  });
});
