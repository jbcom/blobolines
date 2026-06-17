import { describe, expect, it } from "vitest";
import { biomeBands, biomeSkyAt } from "../biomes";

describe("biomeSkyAt", () => {
  it("returns the ground band at/below height 0", () => {
    expect(biomeSkyAt(0).top).toBe(biomeBands[0].sky.top);
    expect(biomeSkyAt(-50).deep).toBe(biomeBands[0].sky.deep);
  });

  const channels = (color: string) => {
    const n = Number.parseInt(color.slice(1), 16);
    return {
      r: (n >> 16) & 0xff,
      g: (n >> 8) & 0xff,
      b: n & 0xff,
    };
  };

  const luminance = (color: string) => {
    const { r, g, b } = channels(color);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };

  it("keeps the low playable bands as bright blue daylight with warm fog", () => {
    for (const band of biomeBands.slice(0, 2)) {
      for (const color of [band.sky.top, band.sky.mid, band.sky.deep]) {
        const { r, g, b } = channels(color);
        expect(luminance(color), `${band.name} ${color} should stay bright`).toBeGreaterThan(125);
        expect(b, `${band.name} ${color} should read as daylight blue`).toBeGreaterThan(r);
        expect(g, `${band.name} ${color} should not drift into sterile navy`).toBeGreaterThan(
          b * 0.55,
        );
      }
      const fog = channels(band.fog);
      expect(fog.r, `${band.name} fog should stay sun-warmed`).toBeGreaterThanOrEqual(fog.b);
      expect(fog.r + fog.g, `${band.name} fog should stay honey/peach, not cold`).toBeGreaterThan(
        fog.b * 2,
      );
      expect(luminance(band.fog), `${band.name} fog should stay bright`).toBeGreaterThan(160);
    }
  });

  it("keeps the ground playfield distinct from warm foreground tokens", () => {
    const ground = biomeSkyAt(0);
    expect(ground.mid).toBe("#8fd7ff");
    expect(ground.deep).toBe("#42a8f5");
    expect(ground.fog).toBe("#ffe1a8");
  });

  it("transitions from daylight into warm sunset before space", () => {
    const upper = biomeSkyAt(320);
    expect(luminance(upper.mid), `${upper.mid} should stay bright`).toBeGreaterThan(125);
    expect(
      channels(upper.mid).b,
      `${upper.mid} should keep daylight blue in the field`,
    ).toBeGreaterThan(channels(upper.mid).r);
    const stratosphere = biomeSkyAt(600);
    for (const color of [stratosphere.top, stratosphere.mid]) {
      const { r, b } = channels(color);
      expect(r, `${color} should warm toward sunset above the playfield`).toBeGreaterThan(b);
    }
  });

  it("returns the deepest band at/above the top band height", () => {
    const last = biomeBands[biomeBands.length - 1];
    expect(biomeSkyAt(last.minHeight).deep).toBe(last.sky.deep);
    expect(biomeSkyAt(99999).deep).toBe(last.sky.deep);
  });

  it("transitions toward space as the blob climbs (deep gets darker)", () => {
    const ground = luminance(biomeSkyAt(0).deep);
    const space = luminance(biomeSkyAt(1400).deep);
    expect(space).toBeLessThan(ground); // deep space is much darker than the ground sky
  });

  it("interpolates between adjacent bands (a midpoint differs from both ends)", () => {
    const mid = biomeSkyAt(60); // between ground(0) and sky(120)
    expect(mid.top).not.toBe(biomeBands[0].sky.top);
    expect(mid.top).not.toBe(biomeBands[1].sky.top);
  });
});
