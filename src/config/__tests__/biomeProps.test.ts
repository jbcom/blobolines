import { describe, expect, it } from "vitest";
import {
  allBiomePropFiles,
  biomeAmbience,
  biomeAmbienceAt,
  biomePropRegistry,
  parallaxLayers,
  propSetForBand,
} from "../biomeProps";
import { biomeBands } from "../biomes";

/** The GLBs that actually exist on disk, enumerated by Vite at import time. Keyed by path
 *  relative to the models dir (e.g. "biomes/ground/cactus-tall.glb") to match registry files. */
const onDiskGlbs = new Set(
  Object.keys(
    import.meta.glob("../../../public/assets/models/biomes/**/*.glb", { eager: false }),
  ).map((p) => p.replace(/^.*\/assets\/models\//, "")),
);

describe("biomePropRegistry", () => {
  it("has exactly one entry per canonical biome band, in band order", () => {
    expect(biomePropRegistry.map((s) => s.band)).toEqual(biomeBands.map((b) => b.name));
  });

  it("gives every band a shelf with a valid kind and hex color", () => {
    for (const set of biomePropRegistry) {
      expect(["disc", "ring"]).toContain(set.shelf.kind);
      expect(set.shelf.color, `${set.band} shelf color`).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(set.shelf.opacity).toBeGreaterThan(0);
      expect(set.shelf.opacity).toBeLessThanOrEqual(1);
      if (set.shelf.kind === "disc") {
        expect(set.shelf.scale, `${set.band} disc needs a scale`).toBeDefined();
      }
    }
  });

  it("references prop files under the band's own models subdirectory with a positive scale", () => {
    for (const set of biomePropRegistry) {
      for (const prop of set.props) {
        expect(prop.file, `${set.band} prop path`).toBe(
          `biomes/${set.band}/${prop.file.split("/").pop()}`,
        );
        expect(prop.file.endsWith(".glb"), `${prop.file} is a glb`).toBe(true);
        expect(prop.scale).toBeGreaterThan(0);
      }
    }
  });

  it("has no duplicate prop files within a band", () => {
    for (const set of biomePropRegistry) {
      const files = set.props.map((p) => p.file);
      expect(new Set(files).size, `${set.band} duplicate prop`).toBe(files.length);
    }
  });

  it("aggregates every prop file for preloading with no duplicates across bands", () => {
    expect(new Set(allBiomePropFiles).size).toBe(allBiomePropFiles.length);
    const flat = biomePropRegistry.flatMap((s) => s.props.map((p) => p.file));
    expect(allBiomePropFiles).toEqual(flat);
  });

  it("resolves a known band and returns undefined for an unknown one", () => {
    expect(propSetForBand(biomeBands[0].name)?.band).toBe(biomeBands[0].name);
    expect(propSetForBand("not-a-real-band")).toBeUndefined();
  });

  it("gives every canonical band a richly varied prop set (≥6 after the variety pass)", () => {
    for (const set of biomePropRegistry) {
      // The variety enrichment curated ~2 more 3DLowPoly props per band on top of the original 4,
      // so a long climb doesn't visibly repeat the same handful. Guard the floor.
      expect(set.props.length, `${set.band} should have a varied prop set`).toBeGreaterThanOrEqual(
        6,
      );
    }
  });

  it("references GLB files that actually exist on disk under public/", () => {
    expect(onDiskGlbs.size, "expected biome GLBs to be discovered on disk").toBeGreaterThan(0);
    for (const file of allBiomePropFiles) {
      expect(onDiskGlbs.has(file), `${file} missing on disk`).toBe(true);
    }
  });
});

describe("biomeAmbience", () => {
  it("defines ambience for every canonical band with valid color, opacity, size and drift", () => {
    expect(biomeAmbience).toHaveLength(biomeBands.length);
    for (const a of biomeAmbience) {
      expect(a.mote, "mote color").toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(a.opacity).toBeGreaterThan(0);
      expect(a.opacity).toBeLessThanOrEqual(1);
      // Per-band particle grain: positive size + drift multipliers give each biome its own feel.
      expect(a.size, "mote size multiplier").toBeGreaterThan(0);
      expect(a.drift, "mote drift multiplier").toBeGreaterThan(0);
    }
  });

  it("gives the particles a distinct grain per biome — heavy slow dust low, fine quick sparkle high", () => {
    const ground = biomeAmbience[0];
    const deepSpace = biomeAmbience[biomeAmbience.length - 1];
    // Ground motes read large + lazy; deep-space motes read tiny + quick.
    expect(ground.size).toBeGreaterThan(deepSpace.size);
    expect(ground.drift).toBeLessThan(deepSpace.drift);
  });

  it("resolves ambience at a representative altitude for each band, matching band order", () => {
    biomeBands.forEach((band, i) => {
      expect(biomeAmbienceAt(band.minHeight + 1)).toEqual(biomeAmbience[i]);
    });
  });

  it("resolves below-ground and very-high altitudes to the edge bands", () => {
    expect(biomeAmbienceAt(-100)).toEqual(biomeAmbience[0]);
    expect(biomeAmbienceAt(99999)).toEqual(biomeAmbience[biomeAmbience.length - 1]);
  });

  it("gives adjacent bands visibly distinct mote tints", () => {
    // The whole point of per-band ambience: no two neighbours share a tint.
    for (let i = 0; i < biomeAmbience.length - 1; i++) {
      expect(biomeAmbience[i].mote).not.toBe(biomeAmbience[i + 1].mote);
    }
  });
});

describe("parallaxLayers", () => {
  it("defines the far/mid/near depth layers exactly once each", () => {
    expect(parallaxLayers.map((l) => l.id)).toEqual(["far", "mid", "near"]);
  });

  it("orders layers front-to-back so depth, drift, and scale form a real parallax gradient", () => {
    const far = parallaxLayers.find((l) => l.id === "far");
    const mid = parallaxLayers.find((l) => l.id === "mid");
    const near = parallaxLayers.find((l) => l.id === "near");
    if (!far || !mid || !near) throw new Error("missing a parallax layer");
    // Far sits furthest behind, near closest to the camera (z increases front-to-back).
    expect(far.zRange[1]).toBeLessThan(mid.zRange[0]);
    expect(mid.zRange[1]).toBeLessThan(near.zRange[0]);
    // Far drifts slowest, near fastest — the parallax cue.
    expect(far.driftScale).toBeLessThan(mid.driftScale);
    expect(mid.driftScale).toBeLessThan(near.driftScale);
    // Far has the tallest wrap column (slowest apparent vertical scroll).
    expect(far.column).toBeGreaterThan(mid.column);
    // Far reads largest (distant silhouettes), and hazier than the solid mid layer.
    expect(far.scale).toBeGreaterThan(mid.scale);
    expect(far.opacity).toBeLessThan(mid.opacity);
  });

  it("gives every layer a positive instance count and sane ranges", () => {
    for (const l of parallaxLayers) {
      expect(l.count).toBeGreaterThan(0);
      expect(l.zRange[0]).toBeLessThan(l.zRange[1]);
      expect(l.column).toBeGreaterThan(0);
      expect(l.opacity).toBeGreaterThan(0);
      expect(l.opacity).toBeLessThanOrEqual(1);
      // xRange feeds createRng.range like zRange, so inverted bounds would break placement.
      expect(l.xRange[0]).toBeLessThan(l.xRange[1]);
    }
  });
});
