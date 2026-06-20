import { mixHex, palette } from "@/styles/tokens";
import { biomeBandAt, biomeBands } from "./biomes";

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
  "upper-atmosphere": {
    kind: "disc",
    color: palette.cloud.bubble,
    opacity: 0.26,
    scale: [2.0, 1.5],
  },
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
  stratosphere: [
    { file: "biomes/stratosphere/mushroom-giant.glb", scale: 1.3 },
    { file: "biomes/stratosphere/mushroom-cluster.glb", scale: 1.2 },
    { file: "biomes/stratosphere/mushroom-toadstool.glb", scale: 1.1 },
    { file: "biomes/stratosphere/exotic-bloom.glb", scale: 1.2 },
  ],
  space: [
    { file: "biomes/space/asteroid-large.glb", scale: 1.5 },
    { file: "biomes/space/meteor-chunk.glb", scale: 1.2 },
    { file: "biomes/space/crystal-asteroid.glb", scale: 1.3 },
    { file: "biomes/space/crystal-shard.glb", scale: 1.1 },
  ],
  "deep-space": [
    { file: "biomes/deep-space/alien-crystal-cluster.glb", scale: 1.4 },
    { file: "biomes/deep-space/alien-undercrystal.glb", scale: 1.3 },
    { file: "biomes/deep-space/crystal-spire.glb", scale: 1.3 },
    { file: "biomes/deep-space/alien-crystal-rock.glb", scale: 1.3 },
  ],
};

/**
 * The biome prop registry: one entry per canonical band, in band order. Built from
 * `biomeBands` so a band that exists in biomes.json but lacks props surfaces loudly
 * (empty `props`) rather than silently — no silent fallbacks (see [[blobolines-no-fallbacks]]).
 *
 * A missing SHELF throws rather than falling back: a band without a defined seat would
 * otherwise render the wrong shelf color/kind (e.g. a ground disc where a cosmic ring
 * belongs), exactly the silent-wrong-render the doctrine forbids. Empty `props` is allowed
 * (the renderer skips empty sets); a missing shelf is a config error to surface loudly.
 */
export const biomePropRegistry: BiomePropSet[] = biomeBands.map((band) => {
  const shelf = SHELVES[band.name];
  if (!shelf) {
    throw new Error(
      `biomePropRegistry: no shelf defined for biome band "${band.name}" — add one to SHELVES.`,
    );
  }
  return { band: band.name, props: PROP_FILES[band.name] ?? [], shelf };
});

/** Lookup the prop set for a canonical band name. Returns undefined for unknown bands. */
export function propSetForBand(bandName: string): BiomePropSet | undefined {
  return biomePropRegistry.find((set) => set.band === bandName);
}

/** Atmospheric ambience per band — the drifting ambient-mote tint + opacity that gives each
 *  stratum its own air. Keyed by canonical band name and resolved via `biomeBandAt`, so the
 *  recolor shares the single-source-of-truth band logic instead of drifted height magic. */
export interface BiomeAmbience {
  /** Ambient mote color for this band. */
  mote: string;
  /** Ambient mote opacity for this band. */
  opacity: number;
}

const AMBIENCE: Record<string, BiomeAmbience> = {
  // Warm petals drift over the sunny ground.
  ground: { mote: mixHex(palette.goo.flame, palette.cream, 0.4), opacity: 0.5 },
  // Icy-cream wind motes through the daylight sky.
  sky: { mote: palette.cream, opacity: 0.5 },
  // Golden pollen haze in the upper atmosphere.
  "upper-atmosphere": { mote: mixHex(palette.tramp.ice, palette.cream, 0.3), opacity: 0.48 },
  // Mystical blush spores in the fungal stratosphere.
  stratosphere: { mote: mixHex(palette.cloud.blush, palette.cream, 0.25), opacity: 0.46 },
  // Nebula-violet dust as the sky gives way to space.
  space: { mote: mixHex(palette.tramp.violet, palette.cream, 0.35), opacity: 0.5 },
  // Cold cosmic glimmer in deep space.
  "deep-space": { mote: mixHex(palette.cloud.bubble, palette.cloud.vortex, 0.45), opacity: 0.52 },
};

/** Ambient-mote ambience for the band containing world height `h`. Throws if the band has
 *  no ambience defined — a config gap to surface loudly, not fall back silently. */
export function biomeAmbienceAt(h: number): BiomeAmbience {
  const band = biomeBandAt(h);
  const ambience = AMBIENCE[band];
  if (!ambience) {
    throw new Error(`biomeAmbienceAt: no ambience defined for biome band "${band}".`);
  }
  return ambience;
}

/** Every canonical band's ambience, in band order — for exhaustive testing. */
export const biomeAmbience: BiomeAmbience[] = biomeBands.map((band) => {
  const ambience = AMBIENCE[band.name];
  if (!ambience) {
    throw new Error(`biomeAmbience: no ambience defined for biome band "${band.name}".`);
  }
  return ambience;
});

/** Every GLB file referenced by the registry — used for preloading. */
export const allBiomePropFiles: string[] = biomePropRegistry.flatMap((set) =>
  set.props.map((p) => p.file),
);
