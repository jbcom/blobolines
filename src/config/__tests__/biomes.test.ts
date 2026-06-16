import { describe, expect, it } from "vitest";
import { biomeBands, biomeSkyAt } from "../biomes";

describe("biomeSkyAt", () => {
  it("returns the ground band at/below height 0", () => {
    expect(biomeSkyAt(0).top).toBe(biomeBands[0].sky.top);
    expect(biomeSkyAt(-50).deep).toBe(biomeBands[0].sky.deep);
  });

  it("returns the deepest band at/above the top band height", () => {
    const last = biomeBands[biomeBands.length - 1];
    expect(biomeSkyAt(last.minHeight).deep).toBe(last.sky.deep);
    expect(biomeSkyAt(99999).deep).toBe(last.sky.deep);
  });

  it("transitions toward space as the blob climbs (deep gets darker)", () => {
    const lum = (hexStr: string) => Number.parseInt(hexStr.slice(1), 16);
    const ground = lum(biomeSkyAt(0).deep);
    const space = lum(biomeSkyAt(1400).deep);
    expect(space).toBeLessThan(ground); // deep space is much darker than the ground sky
  });

  it("interpolates between adjacent bands (a midpoint differs from both ends)", () => {
    const mid = biomeSkyAt(60); // between ground(0) and sky(120)
    expect(mid.top).not.toBe(biomeBands[0].sky.top);
    expect(mid.top).not.toBe(biomeBands[1].sky.top);
  });
});
