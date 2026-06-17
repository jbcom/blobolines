import { describe, expect, it } from "vitest";
import { bodyLobes } from "../bodyLobes";

describe("bodyLobes", () => {
  it("keeps intrinsic asymmetric mass present at rest", () => {
    const lobes = bodyLobes({
      time: 1.2,
      settled: 1,
      velocity: [0, 0, 0],
      radius: 0.85,
      aimCharge: 0,
      idleSeconds: 0,
      excitement: 0,
    });

    expect(lobes).toHaveLength(3);
    expect(lobes.some((l) => Math.hypot(l.position[0], l.position[2]) > 0.25)).toBe(true);
    expect(lobes.some((l) => l.position[1] < -0.25)).toBe(true);
  });

  it("pushes a leading lobe into the launch/aim direction", () => {
    const calm = bodyLobes({
      time: 0,
      settled: 0,
      velocity: [0, 0, 0],
      radius: 0.85,
      aimCharge: 0,
      idleSeconds: 0,
      excitement: 0,
    });
    const charged = bodyLobes({
      time: 0,
      settled: 0,
      velocity: [8, 20, 0],
      radius: 0.85,
      aimCharge: 1,
      idleSeconds: 0,
      excitement: 0,
    });

    expect(charged[2].position[0]).toBeGreaterThan(calm[2].position[0]);
    expect(charged[2].position[1]).toBeGreaterThan(calm[2].position[1]);
  });

  it("perks up after an exciting bounce", () => {
    const calm = bodyLobes({
      time: 0.5,
      settled: 1,
      velocity: [0, 0, 0],
      radius: 0.85,
      aimCharge: 0,
      idleSeconds: 0,
      excitement: 0,
    });
    const excited = bodyLobes({
      time: 0.5,
      settled: 1,
      velocity: [0, 0, 0],
      radius: 0.85,
      aimCharge: 0,
      idleSeconds: 0,
      excitement: 1,
    });

    expect(excited[2].position[1]).toBeGreaterThan(calm[2].position[1]);
    expect(excited[2].scale[1]).toBeGreaterThan(calm[2].scale[1]);
  });
});
