import { describe, expect, it } from "vitest";
import { advance, createStepLoop, FIXED_DT, MAX_STEPS_PER_FRAME } from "../loop";

describe("fixed-timestep loop", () => {
  it("runs one step per fixed-dt of accumulated time", () => {
    const loop = createStepLoop();
    let steps = 0;
    const ran = advance(loop, FIXED_DT, () => steps++);
    expect(ran).toBe(1);
    expect(steps).toBe(1);
  });

  it("accumulates sub-step time across frames", () => {
    const loop = createStepLoop();
    let steps = 0;
    advance(loop, FIXED_DT / 2, () => steps++); // not enough yet
    expect(steps).toBe(0);
    advance(loop, FIXED_DT / 2 + 1e-6, () => steps++); // now crosses the threshold
    expect(steps).toBe(1);
  });

  it("runs multiple steps for a large delta", () => {
    const loop = createStepLoop();
    let steps = 0;
    advance(loop, FIXED_DT * 3, () => steps++);
    expect(steps).toBe(3);
  });

  it("caps steps per frame to avoid the spiral of death", () => {
    const loop = createStepLoop();
    let steps = 0;
    // A 10s stall would be 600 steps; clamped to MAX_FRAME_DELTA then step-capped.
    advance(loop, 10, () => steps++);
    expect(steps).toBeLessThanOrEqual(MAX_STEPS_PER_FRAME);
  });

  it("uses fixed dt for every step regardless of frame delta", () => {
    const loop = createStepLoop();
    const dts: number[] = [];
    advance(loop, FIXED_DT * 2.5, (dt) => dts.push(dt));
    expect(dts.every((d) => d === FIXED_DT)).toBe(true);
  });

  it("reports alpha in [0,1) for render interpolation", () => {
    const loop = createStepLoop();
    advance(loop, FIXED_DT * 1.4, () => {});
    expect(loop.alpha).toBeGreaterThanOrEqual(0);
    expect(loop.alpha).toBeLessThan(1);
    expect(loop.alpha).toBeCloseTo(0.4, 5);
  });

  it("is deterministic for the same delta sequence", () => {
    const run = () => {
      const loop = createStepLoop();
      let steps = 0;
      for (const d of [0.01, 0.02, 0.016, 0.05, 0.008]) {
        advance(loop, d, () => steps++);
      }
      return { steps, total: loop.steps };
    };
    expect(run()).toEqual(run());
  });
});
