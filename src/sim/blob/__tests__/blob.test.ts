import { describe, expect, it } from "vitest";
import {
  classifyExpression,
  combineScale,
  eyeShape,
  faceFocusDartFromNdc,
  heroIdleBurble,
  impactSquash,
  mouthShape,
  speedStretch,
  stepIdlePatience,
} from "../index";

describe("speedStretch", () => {
  it("is round at rest", () => {
    expect(speedStretch(0, 0, 0)).toEqual({ x: 1, y: 1, z: 1 });
  });

  it("stretches Y and shrinks XZ when moving fast (volume-ish conserving)", () => {
    const s = speedStretch(0, 40, 0);
    expect(s.y).toBeGreaterThan(1);
    expect(s.x).toBeLessThan(1);
    expect(s.z).toBeLessThan(1);
  });

  it("saturates at maxStretch", () => {
    const s = speedStretch(0, 1000, 0);
    expect(s.y).toBeCloseTo(1.4, 5);
  });
});

describe("impactSquash", () => {
  it("no squash at zero impact", () => {
    expect(impactSquash(0)).toEqual({ x: 1, y: 1, z: 1 });
  });

  it("flattens Y and bulges XZ on impact", () => {
    const s = impactSquash(1);
    expect(s.y).toBeLessThan(1);
    expect(s.x).toBeGreaterThan(1);
    expect(s.z).toBeGreaterThan(1);
  });
});

describe("combineScale", () => {
  it("multiplies component-wise", () => {
    expect(combineScale({ x: 2, y: 3, z: 4 }, { x: 0.5, y: 2, z: 1 })).toEqual({
      x: 1,
      y: 6,
      z: 4,
    });
  });
});

describe("classifyExpression", () => {
  const base = { vy: 0, impact: 0, fallDepth: 0, airborne: true };

  it("idle by default", () => {
    expect(classifyExpression(base)).toBe("idle");
  });

  it("squints on hard impact", () => {
    expect(classifyExpression({ ...base, impact: 0.8 })).toBe("squint");
  });

  it("goes wide on fast ascent", () => {
    expect(classifyExpression({ ...base, vy: 25 })).toBe("wide");
  });

  it("tears up when falling far", () => {
    expect(classifyExpression({ ...base, vy: -20, fallDepth: 20 })).toBe("tear");
  });

  it("tear outranks squint when both apply", () => {
    expect(classifyExpression({ vy: -20, impact: 0.9, fallDepth: 20, airborne: true })).toBe(
      "tear",
    );
  });
});

describe("eyeShape", () => {
  it("idle is fully open", () => {
    expect(eyeShape("idle").openY).toBe(1);
  });

  it("squint reduces vertical opening", () => {
    expect(eyeShape("squint").openY).toBeLessThan(1);
  });

  it("wide enlarges scale and pupil", () => {
    const s = eyeShape("wide");
    expect(s.scale).toBeGreaterThan(1);
    expect(s.pupil).toBeGreaterThan(1);
  });

  it("tear sets a tear amount", () => {
    expect(eyeShape("tear").tear).toBe(1);
  });

  it("blink closes the eyes regardless of expression", () => {
    expect(eyeShape("wide", 1).openY).toBeCloseTo(0, 5);
  });
});

describe("faceFocusDartFromNdc", () => {
  it("points pupils toward the projected route target", () => {
    const [x, y] = faceFocusDartFromNdc([0, 0], [0.5, 0.25], 1);

    expect(x).toBeGreaterThan(0);
    expect(y).toBeGreaterThan(0);
  });

  it("clamps large screen-space deltas", () => {
    const [x, y] = faceFocusDartFromNdc([0, 0], [10, -10], 1);

    expect(x).toBeCloseTo(0.085);
    expect(y).toBeCloseTo(-0.085);
  });

  it("scales down with focus intensity", () => {
    const strong = faceFocusDartFromNdc([0, 0], [0.8, 0], 1)[0];
    const soft = faceFocusDartFromNdc([0, 0], [0.8, 0], 0.25)[0];

    expect(soft).toBeGreaterThan(0);
    expect(soft).toBeLessThan(strong);
  });
});

describe("mouthShape", () => {
  it("idle is a gentle closed smile", () => {
    const m = mouthShape("idle");
    expect(m.open).toBeLessThan(0.3);
    expect(m.curve).toBeGreaterThan(0); // smiling
  });

  it("wide (rocketing up) opens wide + smiles", () => {
    const m = mouthShape("wide");
    expect(m.open).toBeGreaterThan(0.6);
    expect(m.curve).toBeGreaterThan(0);
  });

  it("squint (hard impact) grimaces (frown)", () => {
    expect(mouthShape("squint").curve).toBeLessThan(0);
  });

  it("tear (near death) opens in dread (frown)", () => {
    const m = mouthShape("tear");
    expect(m.open).toBeGreaterThan(0.3);
    expect(m.curve).toBeLessThan(0);
  });
});

describe("stepIdlePatience", () => {
  it("accumulates visual idle time without launching", () => {
    const stepped = stepIdlePatience({
      idleSeconds: 4.9,
      dt: 0.2,
      resting: true,
      aiming: false,
    });

    expect(stepped.idleSeconds).toBeCloseTo(5.1);
  });

  it("keeps accumulating after player control instead of launching", () => {
    const stepped = stepIdlePatience({
      idleSeconds: 4.9,
      dt: 0.2,
      resting: true,
      aiming: false,
    });

    expect(stepped.idleSeconds).toBeCloseTo(5.1);
  });

  it("resets idle impatience while airborne or aiming", () => {
    expect(
      stepIdlePatience({
        idleSeconds: 3,
        dt: 0.1,
        resting: false,
        aiming: false,
      }),
    ).toEqual({ idleSeconds: 0 });
    expect(
      stepIdlePatience({
        idleSeconds: 3,
        dt: 0.1,
        resting: true,
        aiming: true,
      }),
    ).toEqual({ idleSeconds: 0 });
  });
});

describe("heroIdleBurble", () => {
  it("cycles the menu hero from a flat puddle into a perky blob", () => {
    const flat = heroIdleBurble(0);
    const perky = heroIdleBurble(1.45);

    expect(flat.scale.y).toBeLessThan(0.9);
    expect(flat.scale.x).toBeGreaterThan(1.15);
    expect(perky.scale.y).toBeGreaterThan(1.25);
    expect(perky.scale.x).toBeLessThan(flat.scale.x);
    expect(perky.offsetY).toBeGreaterThan(flat.offsetY);
  });

  it("scales to zero for fixtures that need a neutral pose", () => {
    const neutral = heroIdleBurble(1.45, 0);

    expect(neutral.scale).toEqual({ x: 1, y: 1, z: 1 });
    expect(neutral.offsetY).toBe(0);
    expect(neutral.excitement).toBe(0);
  });
});
