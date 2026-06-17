import { describe, expect, it } from "vitest";
import { blobSkinColor, hex, palette, trampColor } from "./tokens";

describe("design tokens", () => {
  it("exposes the four blob skins from the cover art", () => {
    expect(Object.keys(blobSkinColor).sort()).toEqual(["blue", "ghost", "ink", "slime"]);
  });

  it("exposes the trampoline gameplay types (incl. super/ice bonus + canted/wobbler nav pads)", () => {
    expect(Object.keys(trampColor).sort()).toEqual([
      "booster",
      "canted",
      "fragile",
      "ice",
      "moving",
      "standard",
      "super",
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
});
