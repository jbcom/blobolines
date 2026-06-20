import { describe, expect, it } from "vitest";
import audioCfg from "../audio.json";
import { biomeBands } from "../biomes";

/**
 * Ambient audio is resolved by biomeBandAt (the canonical band logic), and setAmbientBand
 * throws on a band with no bed (no silent fallback). So every canonical biome band MUST map
 * to an ambient bed in audio.json — this guards that invariant at config level, where a
 * mismatch is otherwise only caught at runtime when the blob climbs into the unmapped band.
 */
describe("ambient audio band coverage", () => {
  const ambient = audioCfg.ambient as Record<string, string>;

  it("maps an ambient bed for every canonical biome band", () => {
    for (const band of biomeBands) {
      expect(ambient[band.name], `band "${band.name}" needs an ambient bed`).toBeTruthy();
      expect(ambient[band.name]).toMatch(/^assets\/audio\/ambient\/.+\.mp3$/);
    }
  });

  it("does not map beds for non-canonical band names", () => {
    const canonical = new Set(biomeBands.map((b) => b.name));
    for (const name of Object.keys(ambient)) {
      expect(canonical.has(name), `"${name}" is not a canonical biome band`).toBe(true);
    }
  });
});

/**
 * Per-band MUSIC mirrors the ambient invariant: setMusicBand resolves the in-game track by
 * biomeBandAt and THROWS on an unmapped band (no silent fallback), so every canonical band must
 * map to its own track in audio.json `bandMusic`. Guards that at config level.
 */
describe("per-band music coverage", () => {
  const bandMusic = audioCfg.bandMusic as Record<string, string>;

  it("maps an in-game music track for every canonical biome band", () => {
    for (const band of biomeBands) {
      expect(bandMusic[band.name], `band "${band.name}" needs a music track`).toBeTruthy();
      expect(bandMusic[band.name]).toMatch(/^assets\/audio\/music\/biomes\/.+\.mp3$/);
    }
  });

  it("does not map music for non-canonical band names", () => {
    const canonical = new Set(biomeBands.map((b) => b.name));
    for (const name of Object.keys(bandMusic)) {
      expect(canonical.has(name), `"${name}" is not a canonical biome band`).toBe(true);
    }
  });

  it("gives every band a DISTINCT track (the climb's sonic progression, not one repeated loop)", () => {
    const tracks = biomeBands.map((b) => bandMusic[b.name]);
    expect(new Set(tracks).size, "each band should have its own track").toBe(tracks.length);
  });
});
