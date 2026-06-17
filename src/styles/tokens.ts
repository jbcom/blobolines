/**
 * Typed design tokens — the TS-side mirror of `tokens.css`. Render/sim code imports
 * these (e.g. blob colors, trampoline colors) so the 3D scene and the DOM UI share one
 * palette. Keep in sync with tokens.css; the brand-hex gate in .claude/gates.json
 * forbids raw hex literals outside this module.
 */

export const palette = {
  blob: {
    ink: "#5a2418",
    blue: "#ff7a3d",
    slime: "#ff4f7b",
    ghost: "#ffd95a",
  },
  tramp: {
    blue: "#ff6f61",
    gold: "#f2c14e",
    orange: "#f08a3c",
    green: "#f7a72e",
    violet: "#ff5ab3",
    ice: "#ffe7a3",
  },
  sky: {
    // Cheerful daylight: blue enough to separate the playfield from mango/berry foregrounds,
    // warmed by honey sun + peach fog so it never reads sterile.
    top: "#eefaff",
    mid: "#8fd7ff",
    deep: "#42a8f5",
    haze: "#d7efff",
  },
  cream: "#f3efd6",
  sun: "#ffd36b",
  goo: {
    splash: "#ff7a3d",
    rim: "#ffe3a6",
    wet: "#ffffff",
    /** Combo "flame" glow — ignites the goo rim warm as the bounce streak builds. */
    flame: "#ffb238",
  },
  /** Procedural-eye colors (sclera/bezel/pupil/glint/tear) — functional, kept here so
   *  the brand gate has one source of truth. */
  eye: {
    sclera: "#f8fbff",
    bezel: "#14110f",
    pupil: "#0a0a0c",
    glint: "#ffffff",
    tear: "#ffd0a6",
  },
  /** Danger red — near-death screen-edge pulse / warning feedback. */
  danger: "#ff3b4e",
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

/** Trampoline gameplay types → token color. `super` = bonus mega-launch; `ice` = very
 *  bouncy but slippery (breaks the clean-combo). */
export type TrampType =
  | "standard"
  | "booster"
  | "moving"
  | "fragile"
  | "super"
  | "ice"
  | "canted"
  | "wobbler";

export const trampColor: Record<TrampType, string> = {
  standard: palette.tramp.blue,
  booster: palette.tramp.orange,
  moving: palette.tramp.gold,
  fragile: palette.tramp.green,
  super: palette.tramp.violet,
  ice: palette.tramp.ice,
  canted: palette.tramp.orange,
  wobbler: palette.tramp.violet,
};

export const motion = {
  easeBounce: [0.34, 1.56, 0.64, 1] as const,
  easeOutSoft: [0.22, 1, 0.36, 1] as const,
  easeSquish: [0.5, 0, 0.1, 1.4] as const,
  durFast: 0.14,
  durBase: 0.24,
  durSlow: 0.42,
} as const;
