import { describe, expect, it } from "vitest";
import { createRng } from "@/core/math";
import type { CrystalTier } from "@/core/types";
import { CRYSTAL_SCALE, CRYSTAL_VALUE, pickCrystalTier } from "../crystalTier";

function distribution(y: number, n = 20000): Record<CrystalTier, number> {
  const rng = createRng("ct");
  const counts: Record<CrystalTier, number> = { common: 0, rare: 0, radiant: 0, treasure: 0 };
  for (let i = 0; i < n; i++) counts[pickCrystalTier(rng, y)]++;
  return counts;
}

describe("crystal tiers", () => {
  it("value rises with rarity, treasure being the jackpot (more crystals = more score)", () => {
    expect(CRYSTAL_VALUE.common).toBeLessThan(CRYSTAL_VALUE.rare);
    expect(CRYSTAL_VALUE.rare).toBeLessThan(CRYSTAL_VALUE.radiant);
    expect(CRYSTAL_VALUE.radiant).toBeLessThan(CRYSTAL_VALUE.treasure);
  });

  it("scale rises with rarity, treasure being the biggest", () => {
    expect(CRYSTAL_SCALE.common).toBeLessThanOrEqual(CRYSTAL_SCALE.rare);
    expect(CRYSTAL_SCALE.rare).toBeLessThan(CRYSTAL_SCALE.radiant);
    expect(CRYSTAL_SCALE.radiant).toBeLessThan(CRYSTAL_SCALE.treasure);
  });

  it("treasure is the rarest tier and stays rare even high up", () => {
    for (const y of [0, 600]) {
      const d = distribution(y);
      // Treasure exists (it's rollable) but is the scarcest — rarer than radiant at any altitude.
      expect(d.treasure).toBeGreaterThan(0);
      expect(d.treasure).toBeLessThan(d.radiant);
    }
  });

  it("is deterministic for the same seed + altitude", () => {
    const a = createRng("z");
    const b = createRng("z");
    const seqA: CrystalTier[] = [];
    const seqB: CrystalTier[] = [];
    for (let i = 0; i < 40; i++) {
      seqA.push(pickCrystalTier(a, 250));
      seqB.push(pickCrystalTier(b, 250));
    }
    expect(seqA).toEqual(seqB);
  });

  it("is mostly common everywhere (rarer tiers stay special)", () => {
    for (const y of [0, 250, 600]) {
      const d = distribution(y);
      expect(d.common).toBeGreaterThan(d.rare + d.radiant + d.treasure);
    }
  });

  it("rarer tiers get MORE common with altitude (climb is rewarded)", () => {
    const low = distribution(0);
    const high = distribution(600);
    expect(high.rare + high.radiant + high.treasure).toBeGreaterThan(
      low.rare + low.radiant + low.treasure,
    );
    expect(high.radiant).toBeGreaterThan(low.radiant);
    expect(high.treasure).toBeGreaterThan(low.treasure);
  });
});
