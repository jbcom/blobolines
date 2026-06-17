import { describe, expect, it } from "vitest";
import { createRng } from "@/core/math";
import { generateUpTo, starterPad } from "../generator";
import { reaches } from "../reachable";

describe("world generator", () => {
  it("is deterministic for the same seed", () => {
    const a = generateUpTo(createRng("seed-x"), 0, 200);
    const b = generateUpTo(createRng("seed-x"), 0, 200);
    expect(a.trampolines).toEqual(b.trampolines);
    expect(a.crystals).toEqual(b.crystals);
  });

  it("differs across seeds", () => {
    const a = generateUpTo(createRng("one"), 0, 200);
    const b = generateUpTo(createRng("two"), 0, 200);
    expect(a.trampolines).not.toEqual(b.trampolines);
  });

  it("generates upward past the target", () => {
    const chunk = generateUpTo(createRng(1), 0, 200);
    expect(chunk.highestY).toBeGreaterThanOrEqual(200);
    expect(chunk.trampolines.length).toBeGreaterThan(0);
    // Monotonic increasing Y.
    const ys = chunk.trampolines.map((t) => t.position[1]);
    for (let i = 1; i < ys.length; i++) expect(ys[i]).toBeGreaterThan(ys[i - 1]);
  });

  it("keeps the low pads forgiving (standard) below y=25", () => {
    const chunk = generateUpTo(createRng(1), 0, 200);
    for (const t of chunk.trampolines) {
      if (t.position[1] < 25) expect(t.type).toBe("standard");
    }
  });

  it("shrinks pads with altitude (difficulty curve)", () => {
    const chunk = generateUpTo(createRng(1), 0, 600);
    const low = chunk.trampolines.find((t) => t.position[1] < 50);
    const high = chunk.trampolines.at(-1);
    expect(low && high).toBeTruthy();
    if (low && high) expect(high.width).toBeLessThan(low.width);
  });

  it("widens vertical spacing with altitude (difficulty curve)", () => {
    const { trampolines } = generateUpTo(createRng(2), 0, 700);
    // Average gap over the low stretch vs the high stretch — gaps should grow as it climbs.
    const gaps: { y: number; gap: number }[] = [];
    for (let i = 1; i < trampolines.length; i++) {
      gaps.push({
        y: trampolines[i].position[1],
        gap: trampolines[i].position[1] - trampolines[i - 1].position[1],
      });
    }
    const lowGaps = gaps.filter((g) => g.y < 100).map((g) => g.gap);
    const highGaps = gaps.filter((g) => g.y > 500).map((g) => g.gap);
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(avg(highGaps)).toBeGreaterThan(avg(lowGaps));
  });

  it("can extend incrementally from a prior height", () => {
    const rng = createRng(7);
    const first = generateUpTo(rng, 0, 100);
    const second = generateUpTo(rng, first.highestY, first.highestY + 100, first.lastPad);
    expect(second.trampolines[0]?.position[1]).toBeGreaterThan(first.highestY);
  });

  // Cross-chunk reachability: threading lastPad lets the cant reach across the seam, so the
  // first pad of the next chunk isn't stranded when it lands far from the prior chunk's last.
  it("cants across the chunk seam (threaded lastPad)", () => {
    const rng = createRng("seam");
    const first = generateUpTo(rng, 0, 100);
    const second = generateUpTo(rng, first.highestY, first.highestY + 100, first.lastPad);
    const a = first.lastPad;
    const b = second.trampolines[0];
    expect(a).not.toBeNull();
    if (a && b) {
      // The seam pair must be reachable — the cant (if any) reaches across the boundary.
      // Either a's flat bounce already reaches b, or threading let it be cant-promoted.
      expect(reaches(a, b)).toBe(true);
    }
    // Sanity: lastPad is exposed on every chunk for threading.
    expect(second.lastPad).not.toBeNull();
  });

  it("spawns power-ups (magnet/thruster) only above the forgiving start", () => {
    const chunk = generateUpTo(createRng(3), 0, 600);
    for (const p of chunk.powerups) {
      expect(p.position[1]).toBeGreaterThan(30);
      expect(["magnet", "thruster", "shield", "slowmo", "doubler", "multibounce"]).toContain(
        p.type,
      );
    }
    // Over a tall tower at least one should appear.
    expect(chunk.powerups.length).toBeGreaterThan(0);
  });

  it("every generated crystal carries a valid rarity tier + position", () => {
    const chunk = generateUpTo(createRng(9), 0, 600);
    expect(chunk.crystals.length).toBeGreaterThan(0);
    for (const c of chunk.crystals) {
      expect(["common", "rare", "radiant"]).toContain(c.tier);
      expect(c.position).toHaveLength(3);
    }
  });

  it("starter pad is centered, large, standard", () => {
    const s = starterPad();
    expect(s.position).toEqual([0, 0, 0]);
    expect(s.type).toBe("standard");
    expect(s.width).toBeGreaterThan(7);
  });

  // Golden-path navigability — STRUCTURAL property: every canted pad's cant is a unit vector
  // pointing toward its successor (so its tilted bounce throws the blob the right way). The
  // *sufficiency* of canting (that the launch actually reaches) is proven separately by the
  // climb proof in reachable.test.ts; here we just assert the placement is well-formed.
  it("cants pads toward their successor (unit vector, correct direction)", () => {
    const { trampolines } = generateUpTo(createRng("climb"), 0, 400);
    let cantedCount = 0;
    for (let i = 0; i < trampolines.length - 1; i++) {
      const a = trampolines[i];
      const b = trampolines[i + 1];
      if (a.type !== "canted") continue;
      expect(a.cant).toBeDefined();
      const [cx, cz] = a.cant ?? [0, 0];
      const dx = b.position[0] - a.position[0];
      const dz = b.position[2] - a.position[2];
      // Cant points toward the successor (positive dot with the offset) + is a unit vec.
      expect(cx * dx + cz * dz).toBeGreaterThan(0);
      expect(Math.hypot(cx, cz)).toBeCloseTo(1, 5);
      cantedCount++;
    }
    // A spiral-placed tower should produce several canted pads.
    expect(cantedCount).toBeGreaterThan(0);
  });
});
