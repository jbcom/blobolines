import { describe, expect, it } from "vitest";
import { allBiomePropFiles, biomePropRegistry, propSetForBand } from "../biomeProps";
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

  it("gives every canonical band a non-empty, varied prop set", () => {
    for (const set of biomePropRegistry) {
      expect(set.props.length, `${set.band} should have props`).toBeGreaterThanOrEqual(2);
    }
  });

  it("references GLB files that actually exist on disk under public/", () => {
    expect(onDiskGlbs.size, "expected biome GLBs to be discovered on disk").toBeGreaterThan(0);
    for (const file of allBiomePropFiles) {
      expect(onDiskGlbs.has(file), `${file} missing on disk`).toBe(true);
    }
  });
});
