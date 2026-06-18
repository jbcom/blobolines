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

  it("uses charged aim direction instead of idle wander for the leading bead", () => {
    const uncharged = bodyLobes({
      time: 0,
      settled: 1,
      velocity: [0, 0, 0],
      radius: 0.85,
      aimCharge: 0,
      aimDirection: [-1, 0.8, 0],
      idleSeconds: 0,
      excitement: 0,
    });
    const aimed = bodyLobes({
      time: 0,
      settled: 1,
      velocity: [0, 0, 0],
      radius: 0.85,
      aimCharge: 1,
      aimDirection: [-1, 0.8, 0],
      idleSeconds: 0,
      excitement: 0,
    });

    expect(uncharged[2].position[0]).toBeGreaterThan(0);
    expect(aimed[2].position[0]).toBeLessThan(-1.05);
    expect(aimed[2].position[1]).toBeGreaterThan(uncharged[2].position[1] + 0.2);
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

  it("burble-perks when the player waits on the first pad", () => {
    const pulsePeak = 0.37;
    const calm = bodyLobes({
      time: pulsePeak,
      settled: 1,
      velocity: [0, 0, 0],
      radius: 0.85,
      aimCharge: 0,
      idleSeconds: 0.4,
      excitement: 0,
    });
    const impatient = bodyLobes({
      time: pulsePeak,
      settled: 1,
      velocity: [0, 0, 0],
      radius: 0.85,
      aimCharge: 0,
      idleSeconds: 6.1,
      excitement: 0,
    });

    expect(impatient[1].position[1]).toBeGreaterThan(calm[1].position[1]);
    expect(impatient[1].scale[1]).toBeGreaterThan(calm[1].scale[1]);
    expect(impatient[2].position[1]).toBeGreaterThan(calm[2].position[1]);
  });

  it("spreads the lower lobe into a cloud cling", () => {
    const settled = bodyLobes({
      time: 0.8,
      settled: 1,
      velocity: [0, 0, 0],
      radius: 0.85,
      aimCharge: 0,
      idleSeconds: 0,
      excitement: 0,
      cloudAdherence: 0,
      cloudOffset: [0.5, -0.25],
    });
    const clinging = bodyLobes({
      time: 0.8,
      settled: 1,
      velocity: [0, 0, 0],
      radius: 0.85,
      aimCharge: 0,
      idleSeconds: 0,
      excitement: 0,
      cloudAdherence: 1,
      cloudOffset: [0.5, -0.25],
    });

    expect(clinging[0].position[1]).toBeLessThan(settled[0].position[1]);
    expect(clinging[0].position[0]).toBeGreaterThan(settled[0].position[0]);
    expect(clinging[0].scale[0]).toBeGreaterThan(settled[0].scale[0]);
    expect(clinging[0].scale[2]).toBeGreaterThan(settled[0].scale[2]);
  });

  it("pulls a stronger launch bead out of a clinging cloud puddle", () => {
    const loose = bodyLobes({
      time: 0,
      settled: 1,
      velocity: [0, 0, 0],
      radius: 0.85,
      aimCharge: 1,
      aimDirection: [1, 0.8, 0],
      idleSeconds: 0,
      excitement: 0,
      cloudAdherence: 0,
    });
    const clinging = bodyLobes({
      time: 0,
      settled: 1,
      velocity: [0, 0, 0],
      radius: 0.85,
      aimCharge: 1,
      aimDirection: [1, 0.8, 0],
      idleSeconds: 0,
      excitement: 0,
      cloudAdherence: 1,
    });

    expect(clinging[2].position[0]).toBeGreaterThan(loose[2].position[0]);
    expect(clinging[2].position[1]).toBeGreaterThan(loose[2].position[1]);
  });
});
