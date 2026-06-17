import { describe, expect, it } from "vitest";
import { createRng } from "@/core/math";
import { routeProfile } from "../difficulty";
import { generateUpTo, starterPad } from "../generator";
import { reaches } from "../reachable";

function lateralGap(a: readonly [number, number, number], b: readonly [number, number, number]) {
  return Math.hypot(b[0] - a[0], b[2] - a[2]);
}

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

  it("opens ready mode with seeded certified mechanics", () => {
    const start = starterPad();
    const chunk = generateUpTo(createRng(1), 0, 80, start, "ready");
    const pads = [start, ...chunk.trampolines];
    const openingTypes = pads.slice(1, 6).map((p) => p.type);
    const openingSourceModes = pads
      .slice(0, 8)
      .map((p) => p.goldenPath?.sourceMode)
      .filter(Boolean);
    const mechanics = new Set(
      openingTypes.filter((type) => ["moving", "canted", "wobbler"].includes(type)),
    );
    expect(mechanics.size).toBeGreaterThanOrEqual(2);
    expect(new Set(openingSourceModes).size).toBeGreaterThanOrEqual(2);
    for (let i = 0; i < 5; i++) {
      expect(pads[i].goldenPath?.variants?.length).toBe(routeProfile("ready").proofVariants);
      expect(pads[i].goldenPath?.toPadId).toBe(pads[i + 1].id);
    }
  });

  it("scales proof leniency and footprint knobs by route difficulty", () => {
    expect(routeProfile("ready").proofVariants).toBe(3);
    expect(routeProfile("medium").proofVariants).toBe(2);
    expect(routeProfile("hard").proofVariants).toBe(1);
    expect(routeProfile("blobmare").proofVariants).toBe(1);
    expect(routeProfile("ultraBlobmare").proofVariants).toBe(1);
    expect(routeProfile("oneWrongMove").proofVariants).toBe(1);

    expect(routeProfile("ready").minFootprint).toBeGreaterThan(routeProfile("medium").minFootprint);
    expect(routeProfile("medium").minFootprint).toBeGreaterThan(routeProfile("hard").minFootprint);
    expect(routeProfile("hard").minFootprint).toBeGreaterThan(
      routeProfile("blobmare").minFootprint,
    );
    expect(routeProfile("blobmare").minFootprint).toBeGreaterThan(
      routeProfile("ultraBlobmare").minFootprint,
    );
    expect(routeProfile("ultraBlobmare").minFootprint).toBeGreaterThan(
      routeProfile("oneWrongMove").minFootprint,
    );

    expect(routeProfile("ready").shapeVariety).toBeLessThan(
      routeProfile("oneWrongMove").shapeVariety,
    );
  });

  it("shrinks pads with altitude (difficulty curve)", () => {
    const low = generateUpTo(createRng("size-curve"), 0, 20, null, "oneWrongMove").trampolines[0];
    const high = generateUpTo(createRng("size-curve"), 600, 620, null, "oneWrongMove")
      .trampolines[0];
    expect(low && high).toBeTruthy();
    if (low && high) {
      expect(Math.max(high.width, high.depth)).toBeLessThan(Math.max(low.width, low.depth));
    }
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

  it("opens every run with visible stepping pads instead of an overhead column", () => {
    for (let seed = 0; seed < 40; seed++) {
      const start = starterPad();
      const { trampolines } = generateUpTo(createRng(`starter-guide-${seed}`), 0, 80, start);
      const pads = [start, ...trampolines];
      for (let i = 1; i <= 3; i++) {
        const previous = pads[i - 1];
        const current = pads[i];
        expect(current, `seed ${seed}: missing opening pad #${i}`).toBeDefined();
        if (!current) continue;

        const dy = current.position[1] - previous.position[1];
        const lateral = lateralGap(previous.position, current.position);
        expect(dy, `seed ${seed}: opening pad #${i} is too high to read`).toBeLessThanOrEqual(9.35);
        expect(
          lateral,
          `seed ${seed}: opening pad #${i} collapsed into a near-overhead stack`,
        ).toBeGreaterThanOrEqual(3.55);
        expect(
          lateral,
          `seed ${seed}: opening pad #${i} is too far off the starter line`,
        ).toBeLessThanOrEqual(10.45);
        expect(
          Math.min(current.width, current.depth),
          `seed ${seed}: opening pad #${i} should be forgivingly large`,
        ).toBeGreaterThanOrEqual(8.4);
        expect(reaches(previous, current), `seed ${seed}: opening pad #${i} is stranded`).toBe(
          true,
        );
      }
    }
  });

  it("opens ready seeds with visible position and type variety", () => {
    const signatures = new Set<string>();
    for (let seed = 0; seed < 24; seed++) {
      const start = starterPad();
      const { trampolines } = generateUpTo(createRng(`opening-variety-${seed}`), 0, 80, start);
      const opening = trampolines.slice(0, 3);
      expect(opening).toHaveLength(3);
      signatures.add(
        opening
          .map((pad, i) => {
            const prev = i === 0 ? start : opening[i - 1];
            return [
              pad.type,
              Math.round(lateralGap(prev.position, pad.position) * 2) / 2,
              Math.round((pad.position[1] - prev.position[1]) * 2) / 2,
              Math.round(Math.max(pad.width, pad.depth) * 2) / 2,
            ].join(":");
          })
          .join("|"),
      );
    }
    expect(signatures.size).toBeGreaterThan(8);
  });

  it("never stacks any consecutive pads immediately overhead", () => {
    for (let seed = 0; seed < 80; seed++) {
      const start = starterPad();
      const { trampolines } = generateUpTo(createRng(`no-stack-${seed}`), 0, 700, start);
      const pads = [start, ...trampolines];
      for (let i = 1; i < pads.length; i++) {
        const previous = pads[i - 1];
        const current = pads[i];
        const lateral = lateralGap(previous.position, current.position);
        expect(
          lateral,
          `seed ${seed}: pad #${i} collapsed into an overhead stack`,
        ).toBeGreaterThanOrEqual(3.4);
        expect(
          previous.goldenPath?.toPadId,
          `seed ${seed}: pad #${i - 1} is missing proof to its successor`,
        ).toBe(current.id);
      }
    }
  });

  it("accepts flat-source routes only through the exact certified variant gate", () => {
    const readyStart = starterPad();
    const readyPads = [
      readyStart,
      ...generateUpTo(createRng("flat-ready"), 0, 500, readyStart, "ready").trampolines,
    ];
    let readyFlatSourcePairs = 0;
    for (let i = 1; i < readyPads.length; i++) {
      const source = readyPads[i - 1];
      const target = readyPads[i];
      if (source.goldenPath?.sourceMode === "flat") readyFlatSourcePairs++;
      expect(source.goldenPath?.toPadId).toBe(target.id);
      expect(source.goldenPath?.variants?.length).toBe(routeProfile("ready").proofVariants);
    }
    expect(readyFlatSourcePairs).toBeGreaterThan(0);

    const hardStart = starterPad();
    const hardPads = [
      hardStart,
      ...generateUpTo(createRng("flat-hard"), 0, 500, hardStart, "hard").trampolines,
    ];
    for (let i = 1; i < hardPads.length; i++) {
      expect(hardPads[i - 1].goldenPath?.variants?.length).toBe(routeProfile("hard").proofVariants);
    }
  });

  // Golden-path navigability — STRUCTURAL property: every canted pad's cant is a unit vector
  // pointing toward its successor (so its tilted bounce throws the blob the right way). The
  // *sufficiency* of canting (that the launch actually reaches) is proven separately by the
  // climb proof in reachable.test.ts; here we just assert the placement is well-formed.
  it("cants pads toward their successor (unit vector, correct direction)", () => {
    let cantedCount = 0;
    const angles = new Set<string>();
    for (let seed = 0; seed < 8; seed++) {
      const { trampolines } = generateUpTo(
        createRng(`climb-${seed}`),
        0,
        700,
        starterPad(),
        "medium",
      );
      for (let i = 0; i < trampolines.length - 1; i++) {
        const a = trampolines[i];
        const b = trampolines[i + 1];
        if (a.type !== "canted") continue;
        expect(a.cant).toBeDefined();
        expect(a.cantAngleRad).toBeGreaterThan(0.17);
        angles.add(a.cantAngleRad?.toFixed(2) ?? "missing");
        const [cx, cz] = a.cant ?? [0, 0];
        const dx = b.position[0] - a.position[0];
        const dz = b.position[2] - a.position[2];
        // Cant points toward the successor (positive dot with the offset) + is a unit vec.
        expect(cx * dx + cz * dz).toBeGreaterThan(0);
        expect(Math.hypot(cx, cz)).toBeCloseTo(1, 5);
        cantedCount++;
      }
    }
    // Seeded towers should produce several canted pads with varied angles.
    expect(cantedCount).toBeGreaterThan(0);
    expect(angles.size).toBeGreaterThan(1);
  });
});
