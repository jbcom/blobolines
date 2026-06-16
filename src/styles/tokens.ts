/**
 * Typed design tokens — the TS-side mirror of `tokens.css`. Render/sim code imports
 * these (e.g. blob colors, trampoline colors) so the 3D scene and the DOM UI share one
 * palette. Keep in sync with tokens.css; the brand-hex gate in .claude/gates.json
 * forbids raw hex literals outside this module.
 */

export const palette = {
  blob: {
    ink: "#14110f",
    blue: "#2e8bf0",
    slime: "#7ed957",
    ghost: "#f4f6fb",
  },
  tramp: {
    blue: "#2f7fd1",
    gold: "#f2c14e",
    orange: "#f08a3c",
    green: "#6cc04a",
    violet: "#9d6cf0",
  },
  sky: {
    // Cheerful, saturated daytime gradient (was a flat desaturated blue-grey that read
    // monochrome): warm peach high up → bright sky-blue → richer indigo at the base.
    top: "#ffe3c4",
    mid: "#6fc8f0",
    deep: "#5a4fb0",
  },
  cream: "#f3efd6",
  goo: {
    splash: "#2e8bf0",
    rim: "#bfe3ff",
    wet: "#ffffff",
    /** Combo "flame" glow — ignites the goo rim warm as the bounce streak builds. */
    flame: "#ff8a3c",
  },
  /** Procedural-eye colors (sclera/bezel/pupil/glint/tear) — functional, kept here so
   *  the brand gate has one source of truth. */
  eye: {
    sclera: "#f8fbff",
    bezel: "#14110f",
    pupil: "#0a0a0c",
    glint: "#ffffff",
    tear: "#bfe3ff",
  },
} as const;

/** Hex string → 0xRRGGBB int for three.js Color/material constructors. */
export const hex = (s: string): number => Number.parseInt(s.replace("#", ""), 16);

/** Blend two hex colors by `t` (0 = a, 1 = b) → "#rrggbb". For tinting tokens together. */
export const mixHex = (a: string, b: string, t: number): string => {
  const pa = hex(a);
  const pb = hex(b);
  const k = Math.max(0, Math.min(1, t));
  const ch = (shift: number) => {
    const ca = (pa >> shift) & 0xff;
    const cb = (pb >> shift) & 0xff;
    return Math.round(ca + (cb - ca) * k);
  };
  const r = ch(16);
  const g = ch(8);
  const bl = ch(0);
  return `#${((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1)}`;
};

/** Blob skin identifiers (the playable characters from the cover art). */
export type BlobSkin = "blue" | "slime" | "ghost" | "ink";

export const blobSkinColor: Record<BlobSkin, string> = {
  blue: palette.blob.blue,
  slime: palette.blob.slime,
  ghost: palette.blob.ghost,
  ink: palette.blob.ink,
};

/** Trampoline gameplay types → token color. `super` is the bonus mega-launch pad. */
export type TrampType = "standard" | "booster" | "moving" | "fragile" | "super";

export const trampColor: Record<TrampType, string> = {
  standard: palette.tramp.blue,
  booster: palette.tramp.orange,
  moving: palette.tramp.gold,
  fragile: palette.tramp.green,
  super: palette.tramp.violet,
};

export const motion = {
  easeBounce: [0.34, 1.56, 0.64, 1] as const,
  easeOutSoft: [0.22, 1, 0.36, 1] as const,
  easeSquish: [0.5, 0, 0.1, 1.4] as const,
  durFast: 0.14,
  durBase: 0.24,
  durSlow: 0.42,
} as const;
