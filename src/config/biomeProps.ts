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
  /** ONE large signature structure that anchors this band's identity — rendered sparse + far on the
   *  landmark parallax layer (a monument, not an accent). One per band. */
  landmark: BiomePropSpec;
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
    { file: "biomes/ground/cactus-barrel.glb", scale: 1.2 },
    { file: "biomes/ground/desert-shrub.glb", scale: 1.3 },
  ],
  sky: [
    { file: "biomes/sky/leafy-tree.glb", scale: 1.4 },
    { file: "biomes/sky/pine-tree.glb", scale: 1.4 },
    { file: "biomes/sky/birch-tree.glb", scale: 1.4 },
    { file: "biomes/sky/fern-bush.glb", scale: 1.1 },
    { file: "biomes/sky/round-pine.glb", scale: 1.4 },
    { file: "biomes/sky/tall-pine.glb", scale: 1.5 },
  ],
  "upper-atmosphere": [
    { file: "biomes/upper-atmosphere/crystal-cluster.glb", scale: 1.2 },
    { file: "biomes/upper-atmosphere/gem-spire.glb", scale: 1.3 },
    { file: "biomes/upper-atmosphere/snowy-rock.glb", scale: 1.2 },
    { file: "biomes/upper-atmosphere/snow-crystal.glb", scale: 1.1 },
    { file: "biomes/upper-atmosphere/ice-gem.glb", scale: 1.6 },
    { file: "biomes/upper-atmosphere/frost-gem.glb", scale: 1.6 },
  ],
  stratosphere: [
    { file: "biomes/stratosphere/mushroom-giant.glb", scale: 1.3 },
    { file: "biomes/stratosphere/mushroom-cluster.glb", scale: 1.2 },
    { file: "biomes/stratosphere/mushroom-toadstool.glb", scale: 1.1 },
    { file: "biomes/stratosphere/exotic-bloom.glb", scale: 1.2 },
    { file: "biomes/stratosphere/spore-bush.glb", scale: 1.3 },
    { file: "biomes/stratosphere/glow-spore.glb", scale: 1.6 },
  ],
  space: [
    { file: "biomes/space/asteroid-large.glb", scale: 1.5 },
    { file: "biomes/space/meteor-chunk.glb", scale: 1.2 },
    { file: "biomes/space/crystal-asteroid.glb", scale: 1.3 },
    { file: "biomes/space/crystal-shard.glb", scale: 1.1 },
    { file: "biomes/space/space-rock.glb", scale: 1.4 },
    { file: "biomes/space/distant-planet.glb", scale: 1.0 },
  ],
  "deep-space": [
    { file: "biomes/deep-space/alien-crystal-cluster.glb", scale: 1.4 },
    { file: "biomes/deep-space/alien-undercrystal.glb", scale: 1.3 },
    { file: "biomes/deep-space/crystal-spire.glb", scale: 1.3 },
    { file: "biomes/deep-space/alien-crystal-rock.glb", scale: 1.3 },
    { file: "biomes/deep-space/cosmic-shard-pink.glb", scale: 1.6 },
    { file: "biomes/deep-space/cosmic-shard-blue.glb", scale: 1.6 },
  ],
};

/** One hero LANDMARK per canonical band — a large signature structure on the far landmark layer
 *  that anchors each band's identity. Scales are tuned per native size to read monumentally large
 *  against the scattered accents (the planets are big meshes, so a modest scale; the small obelisk
 *  is scaled up). A missing landmark throws at registry build (no silent fallback). */
const LANDMARK_FILES: Record<string, BiomePropSpec> = {
  ground: { file: "landmarks/ground/obelisk.glb", scale: 3.4 },
  sky: { file: "landmarks/sky/great-pine.glb", scale: 2.6 },
  "upper-atmosphere": { file: "landmarks/upper-atmosphere/ice-spire.glb", scale: 3.0 },
  stratosphere: { file: "landmarks/stratosphere/monolith-spire.glb", scale: 3.0 },
  space: { file: "landmarks/space/ringed-planet.glb", scale: 1.3 },
  "deep-space": { file: "landmarks/deep-space/gas-giant.glb", scale: 1.4 },
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
  const landmark = LANDMARK_FILES[band.name];
  if (!landmark) {
    throw new Error(
      `biomePropRegistry: no landmark defined for biome band "${band.name}" — add one to LANDMARK_FILES.`,
    );
  }
  return { band: band.name, props: PROP_FILES[band.name] ?? [], shelf, landmark };
});

/** Lookup the prop set for a canonical band name. Returns undefined for unknown bands. */
export function propSetForBand(bandName: string): BiomePropSet | undefined {
  return biomePropRegistry.find((set) => set.band === bandName);
}

/**
 * Parallax depth layers for the biome scenery. The climb is rendered in depth bands that drift
 * at different rates so the world reads deep instead of flat: a FAR backdrop of large, slow,
 * sparse silhouettes; the MID layer of detailed props; and a NEAR layer of fast, sparse accents
 * that sweep past the camera. Each layer reuses the same per-band prop registry + biomeBandAt; it
 * only varies depth (z), how fast it drifts sideways with the climb, scale, density, and the
 * vertical wrap-column height (taller column ⇒ slower apparent vertical scroll ⇒ feels distant).
 */
export interface ParallaxLayer {
  /** Layer id, for keys/labels. The `landmark` layer renders the band's single hero structure
   *  (not the prop pool) — see BiomeScenicProps. */
  id: "far" | "mid" | "near" | "landmark";
  /** [min, max] world-X placement range. Near layers stay tighter so their fast-drifting accents
   *  don't spend most of their time off-screen (their tiny frustum at close z). */
  xRange: [number, number];
  /** [min, max] world-Z placement range (more negative = further behind the playfield). */
  zRange: [number, number];
  /** Number of prop instances in this layer. */
  count: number;
  /** Base scale multiplier applied on top of each prop's own scale (far props read large). */
  scale: number;
  /** Sideways drift speed multiplier (near layers sweep faster for a stronger parallax cue). */
  driftScale: number;
  /** Vertical wrap-column height (m); taller ⇒ the layer scrolls past more slowly. */
  column: number;
  /** Opacity multiplier — far silhouettes sit back hazier, near accents read solid. */
  opacity: number;
}

export const parallaxLayers: ParallaxLayer[] = [
  // Far backdrop: big, sparse, slow, hazy silhouettes set well behind everything (wide x — its
  // large frustum at far z keeps them on-screen).
  {
    id: "far",
    xRange: [-24, 24],
    zRange: [-62, -42],
    count: 8,
    scale: 2.6,
    driftScale: 0.35,
    column: 150,
    opacity: 0.6,
  },
  // Mid: the detailed scenery layer that carries the bulk of the biome read (seed 444 — its own
  // independent layout; not pinned to any specific pre-refactor arrangement).
  {
    id: "mid",
    xRange: [-24, 24],
    zRange: [-26, -10],
    count: 16,
    scale: 1.0,
    driftScale: 1.0,
    column: 95,
    opacity: 1,
  },
  // Near: sparse accents close to the camera that sweep past fast — kept in a tight x range so
  // they frame the playfield rather than drifting in from far off-screen.
  {
    id: "near",
    xRange: [-9, 9],
    zRange: [-6, 1],
    count: 5,
    scale: 0.7,
    driftScale: 1.8,
    column: 70,
    opacity: 0.9,
  },
  // Landmark: the band's single hero structure, set FAR back and off to one side, drifting very
  // slowly past (tall column) so it reads as a distant monument anchoring the band rather than
  // clutter. count 1 = one visible at a time; large scale; slightly hazy like the far layer.
  {
    id: "landmark",
    xRange: [-30, 30],
    zRange: [-78, -64],
    count: 1,
    scale: 4.0,
    driftScale: 0.2,
    column: 240,
    opacity: 0.78,
  },
];

/** Atmospheric ambience per band — the drifting ambient-mote tint + opacity that gives each
 *  stratum its own air. Keyed by canonical band name and resolved via `biomeBandAt`, so the
 *  recolor shares the single-source-of-truth band logic instead of drifted height magic. */
export interface BiomeAmbience {
  /** Ambient mote color for this band. */
  mote: string;
  /** Ambient mote opacity for this band. */
  opacity: number;
  /** Per-band mote size multiplier — heavy warm dust low, fine sparkle high — so each biome's
   *  particles read with a distinct grain, not just a recolor. */
  size: number;
  /** Per-band sideways drift-speed multiplier — lazy drift on the ground, brisk cosmic shimmer. */
  drift: number;
}

const AMBIENCE: Record<string, BiomeAmbience> = {
  // Warm petals drift over the sunny ground — large, lazy, heavy dust.
  ground: {
    mote: mixHex(palette.goo.flame, palette.cream, 0.4),
    opacity: 0.5,
    size: 1.5,
    drift: 0.7,
  },
  // Icy-cream wind motes through the daylight sky — medium, breezier.
  sky: { mote: palette.cream, opacity: 0.5, size: 1.1, drift: 1.1 },
  // Golden pollen glints in the upper atmosphere — fine, drifting.
  "upper-atmosphere": {
    mote: mixHex(palette.tramp.ice, palette.cream, 0.3),
    opacity: 0.48,
    size: 0.9,
    drift: 1.0,
  },
  // Mystical blush spores in the fungal stratosphere — puffier, slow-floating.
  stratosphere: {
    mote: mixHex(palette.cloud.blush, palette.cream, 0.25),
    opacity: 0.46,
    size: 1.3,
    drift: 0.6,
  },
  // Nebula-violet dust as the sky gives way to space — fine, faster.
  space: {
    mote: mixHex(palette.tramp.violet, palette.cream, 0.35),
    opacity: 0.5,
    size: 0.8,
    drift: 1.4,
  },
  // Cold cosmic glimmer in deep space — tiny, quick sparkle.
  "deep-space": {
    mote: mixHex(palette.cloud.bubble, palette.cloud.vortex, 0.45),
    opacity: 0.52,
    size: 0.65,
    drift: 1.6,
  },
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
export const allBiomePropFiles: string[] = biomePropRegistry.flatMap((set) => [
  ...set.props.map((p) => p.file),
  set.landmark.file,
]);
