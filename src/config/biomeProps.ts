import { palette } from "@/styles/tokens";
import { biomeBands } from "./biomes";

/**
 * Data-driven biome scenery registry. Each canonical biome band (from biomes.json, via
 * `biomeBands` / `biomeBandAt`) maps to a set of low-poly GLB props plus a "shelf" — the
 * soft decorative disc/ring rendered beneath each prop to seat it against the backdrop.
 *
 * `BiomeScenicProps` reads this registry instead of hardcoding four model components and
 * its own drifted altitude thresholds: adding a prop is a data edit here, and band
 * membership stays the single-source-of-truth `biomeBandAt`.
 *
 * GLBs live under `public/assets/models/biomes/<band>/` (curated 3DLowPoly props from the
 * NAS asset library; textures embedded). `file` is the path relative to the models dir.
 */

/** Shelf rendered beneath a prop: a flat translucent disc, or a glowing celestial ring
 *  for the airless cosmic bands where a "ground" shelf would read wrong. */
export interface PropShelf {
  kind: "disc" | "ring";
  /** Hex color (from the cloud palette) for the shelf material. */
  color: string;
  /** Base opacity of the shelf. */
  opacity: number;
  /** Disc only: [x, y] radius scale relative to the unit geometry. */
  scale?: [number, number];
}

export interface BiomePropSpec {
  /** Path relative to `${BASE_URL}assets/models/` — e.g. "biomes/ground/cactus-tall.glb". */
  file: string;
  /** Per-model base scale multiplier (props vary in native size). */
  scale: number;
}

export interface BiomePropSet {
  /** Canonical biome band name (must match a `biomeBands[].name`). */
  band: string;
  /** Varied props shown when the blob is in this band. */
  props: BiomePropSpec[];
  /** Decorative seat rendered beneath each prop in this band. */
  shelf: PropShelf;
}

/** Soft seat styling per band — warm shelves low, mystical mid, glowing rings in space. */
const SHELVES: Record<string, PropShelf> = {
  ground: { kind: "disc", color: palette.cloud.warm, opacity: 0.28, scale: [2.0, 1.4] },
  sky: { kind: "disc", color: palette.cloud.puff, opacity: 0.3, scale: [2.4, 1.8] },
  "upper-atmosphere": { kind: "disc", color: palette.cloud.bubble, opacity: 0.26, scale: [2.0, 1.5] },
  stratosphere: { kind: "disc", color: palette.cloud.blush, opacity: 0.28, scale: [2.0, 1.5] },
  space: { kind: "ring", color: palette.cloud.glow, opacity: 0.32 },
  "deep-space": { kind: "ring", color: palette.cloud.gold, opacity: 0.34 },
};

/**
 * The curated prop file lists per band. Populated from the asset-curation manifest; kept
 * as a flat map so the registry below can validate every band against the canonical bands.
 */
const PROP_FILES: Record<string, BiomePropSpec[]> = {
  ground: [
    { file: "biomes/ground/cactus-tall.glb", scale: 1.3 },
    { file: "biomes/ground/cactus-flowering.glb", scale: 1.2 },
    { file: "biomes/ground/desert-rock.glb", scale: 1.1 },
    { file: "biomes/ground/dead-tree.glb", scale: 1.4 },
  ],
  sky: [
    { file: "biomes/sky/leafy-tree.glb", scale: 1.4 },
    { file: "biomes/sky/pine-tree.glb", scale: 1.4 },
    { file: "biomes/sky/birch-tree.glb", scale: 1.4 },
    { file: "biomes/sky/fern-bush.glb", scale: 1.1 },
  ],
  "upper-atmosphere": [
    { file: "biomes/upper-atmosphere/crystal-cluster.glb", scale: 1.2 },
    { file: "biomes/upper-atmosphere/gem-spire.glb", scale: 1.3 },
    { file: "biomes/upper-atmosphere/snowy-rock.glb", scale: 1.2 },
    { file: "biomes/upper-atmosphere/snow-crystal.glb", scale: 1.1 },
  ],
  stratosphere: [],
  space: [],
  "deep-space": [],
};

/**
 * The biome prop registry: one entry per canonical band, in band order. Built from
 * `biomeBands` so a band that exists in biomes.json but lacks props surfaces loudly
 * (empty `props`) rather than silently — no silent fallbacks (see [[blobolines-no-fallbacks]]).
 */
export const biomePropRegistry: BiomePropSet[] = biomeBands.map((band) => ({
  band: band.name,
  props: PROP_FILES[band.name] ?? [],
  shelf: SHELVES[band.name] ?? SHELVES.ground,
}));

/** Lookup the prop set for a canonical band name. Returns undefined for unknown bands. */
export function propSetForBand(bandName: string): BiomePropSet | undefined {
  return biomePropRegistry.find((set) => set.band === bandName);
}

/** Every GLB file referenced by the registry — used for preloading. */
export const allBiomePropFiles: string[] = biomePropRegistry.flatMap((set) =>
  set.props.map((p) => p.file),
);
