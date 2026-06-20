import { describe, expect, it } from "vitest";
import { blobSkinColor, hex, palette, rgbNorm, trampColor } from "./tokens";

describe("design tokens", () => {
  it("exposes the four blob skins from the cover art", () => {
    expect(Object.keys(blobSkinColor).sort()).toEqual(["blue", "ghost", "ink", "slime"]);
  });

  it("exposes the trampoline gameplay types (incl. super/ice bonus + canted/wobbler nav pads)", () => {
    expect(Object.keys(trampColor).sort()).toEqual([
      "booster",
      "bubble",
      "canted",
      "fragile",
      "ice",
      "moving",
      "standard",
      "storm",
      "super",
      "vortex",
      "wobbler",
    ]);
  });

  it("maps every palette color to a valid 6-digit hex", () => {
    const all = [
      ...Object.values(palette.blob),
      ...Object.values(palette.tramp),
      ...Object.values(palette.sky),
      palette.cream,
      palette.sun,
    ];
    for (const c of all) {
      expect(c).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it("hex() converts a css color to a three.js int", () => {
    expect(hex("#2e8bf0")).toBe(0x2e8bf0);
    expect(hex("ffffff")).toBe(0xffffff);
  });

  it("rgbNorm() converts a hex to a normalized [0,1] RGB triple", () => {
    expect(rgbNorm("#ffffff")).toEqual([1, 1, 1]);
    expect(rgbNorm("#000000")).toEqual([0, 0, 0]);
    const [r, g, b] = rgbNorm("#ffd180"); // the scenery glint tint
    expect(r).toBeCloseTo(1, 5);
    expect(g).toBeCloseTo(0.819, 2);
    expect(b).toBeCloseTo(0.502, 2);
  });

  it("owns the scenery glint tint as a token (not a raw RGB literal in scene code)", () => {
    expect(palette.scenery.glint).toMatch(/^#[0-9a-f]{6}$/i);
  });
});
