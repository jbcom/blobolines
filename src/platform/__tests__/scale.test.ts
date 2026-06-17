import { describe, expect, it } from "vitest";
import { deviceScale } from "../scale";

describe("deviceScale", () => {
  it("classifies a small touch phone and scales the UI up", () => {
    const r = deviceScale({ minDim: 360, coarsePointer: true });
    expect(r.deviceClass).toBe("phone");
    expect(r.scale).toBeGreaterThan(1);
  });

  it("scales a mid phone up a touch", () => {
    const r = deviceScale({ minDim: 420, coarsePointer: true });
    expect(r.deviceClass).toBe("phone");
    expect(r.scale).toBeGreaterThan(1);
    expect(r.scale).toBeLessThan(1.18);
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
