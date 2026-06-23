import { describe, expect, it } from "vitest";
import { deviceScale } from "../scale";

describe("deviceScale", () => {
  // The HUD must NEVER grow into a small phone's tiny play area. A small touch screen is exactly
  // where screen real estate is scarcest, so the readouts scale DOWN a touch (not up). Thumb-sized
  // tap targets come from per-component min sizes, not a global upscale.
  it("scales the smallest phones DOWN so the HUD never occludes the play area", () => {
    const r = deviceScale({ minDim: 360, coarsePointer: true });
    expect(r.deviceClass).toBe("phone");
    expect(r.scale).toBeLessThan(1);
  });

  it("keeps a mid phone at baseline (no upscale eating the screen)", () => {
    const r = deviceScale({ minDim: 420, coarsePointer: true });
    expect(r.deviceClass).toBe("phone");
    expect(r.scale).toBe(1);
  });

  it("never returns a phone scale above baseline", () => {
    for (const minDim of [320, 360, 380, 420, 540, 599]) {
      expect(deviceScale({ minDim, coarsePointer: true }).scale).toBeLessThanOrEqual(1);
    }
  });

  it("classifies a touch tablet at baseline scale", () => {
    const r = deviceScale({ minDim: 800, coarsePointer: true });
    expect(r.deviceClass).toBe("tablet");
    expect(r.scale).toBe(1);
  });

  it("classifies a fine-pointer desktop at baseline", () => {
    const r = deviceScale({ minDim: 1080, coarsePointer: false });
    expect(r.deviceClass).toBe("desktop");
    expect(r.scale).toBe(1);
  });

  it("bumps a very large desktop slightly", () => {
    const r = deviceScale({ minDim: 1700, coarsePointer: false });
    expect(r.deviceClass).toBe("desktop");
    expect(r.scale).toBeGreaterThan(1);
  });
});
