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
  },
  sky: {
    top: "#cfe0e8",
    mid: "#8fb3c4",
    deep: "#4f7488",
  },
  cream: "#f3efd6",
  goo: {
    splash: "#2e8bf0",
    rim: "#bfe3ff",
    wet: "#ffffff",
  },
} as const;

/** Hex string → 0xRRGGBB int for three.js Color/material constructors. */
export const hex = (s: string): number => Number.parseInt(s.replace("#", ""), 16);

/** Blob skin identifiers (the playable characters from the cover art). */
export type BlobSkin = "blue" | "slime" | "ghost" | "ink";

export const blobSkinColor: Record<BlobSkin, string> = {
  blue: palette.blob.blue,
  slime: palette.blob.slime,
  ghost: palette.blob.ghost,
  ink: palette.blob.ink,
};

/** Trampoline gameplay types → token color. */
export type TrampType = "standard" | "booster" | "moving" | "fragile";

export const trampColor: Record<TrampType, string> = {
  standard: palette.tramp.blue,
  booster: palette.tramp.orange,
  moving: palette.tramp.gold,
  fragile: palette.tramp.green,
};

export const motion = {
  easeBounce: [0.34, 1.56, 0.64, 1] as const,
  easeOutSoft: [0.22, 1, 0.36, 1] as const,
  easeSquish: [0.5, 0, 0.1, 1.4] as const,
  durFast: 0.14,
  durBase: 0.24,
  durSlow: 0.42,
} as const;
