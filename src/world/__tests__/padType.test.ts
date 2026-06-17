import { describe, expect, it } from "vitest";
import { createRng } from "@/core/math";
import type { TrampType } from "@/core/types";
import { padTypeWeights, pickPadType } from "../padType";

function distribution(y: number, n = 4000): Record<string, number> {
  const rng = createRng("dist");
  const counts: Record<string, number> = {};
  for (let i = 0; i < n; i++) {
    const t = pickPadType(rng, y);
    counts[t] = (counts[t] ?? 0) + 1;
  }
  return counts;
}

describe("pickPadType (altitude-weighted)", () => {
  it("is deterministic for the same seed + altitude", () => {
    const a = createRng("x");
    const b = createRng("x");
    const seqA: TrampType[] = [];
    const seqB: TrampType[] = [];
    for (let i = 0; i < 50; i++) {
      seqA.push(pickPadType(a, 200));
      seqB.push(pickPadType(b, 200));
    }
    expect(seqA).toEqual(seqB);
  });

  it("never rolls canted (generator promotes those for reachability)", () => {
    for (const y of [25, 100, 300, 600]) {
      const d = distribution(y);
      expect(d.canted).toBeUndefined();
    }
  });

  it("low altitude is mostly safe standard pads", () => {
    const d = distribution(30);
    // standard should be the clear plurality near the start.
    const standard = d.standard ?? 0;
    for (const [type, count] of Object.entries(d)) {
      if (type !== "standard") expect(standard).toBeGreaterThan(count);
    }
  });

  it("super/wobbler bonus+skill types are rarer-to-absent low, present high", () => {
    const low = distribution(30);
    const high = distribution(450);
    // Wobbler doesn't exist at the start band but appears up high.
    expect(low.wobbler ?? 0).toBe(0);
    expect(high.wobbler ?? 0).toBeGreaterThan(0);
    // Super is a treat: much rarer than standard everywhere it appears.
    expect(high.super ?? 0).toBeLessThan(high.standard ?? Number.POSITIVE_INFINITY);
  });

  it("standard's share THINS as the climb gets harder (variety rises with altitude)", () => {
    const lowW = padTypeWeights(30);
    const highW = padTypeWeights(450);
    const lowShare = (lowW.standard ?? 0) / sum(lowW);
    const highShare = (highW.standard ?? 0) / sum(highW);
    expect(highShare).toBeLessThan(lowShare);
  });
});

function sum(w: Partial<Record<TrampType, number>>): number {
  return Object.values(w).reduce((a, b) => a + (b ?? 0), 0);
}
