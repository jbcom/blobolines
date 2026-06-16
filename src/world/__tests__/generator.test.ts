import { describe, expect, it } from "vitest";
import { createRng } from "@/core/math";
import { generateUpTo, starterPad } from "../generator";

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

  it("can extend incrementally from a prior height", () => {
    const rng = createRng(7);
    const first = generateUpTo(rng, 0, 100);
    const second = generateUpTo(rng, first.highestY, first.highestY + 100);
    expect(second.trampolines[0]?.position[1]).toBeGreaterThan(first.highestY);
  });

  it("spawns power-ups (magnet/thruster) only above the forgiving start", () => {
    const chunk = generateUpTo(createRng(3), 0, 600);
    for (const p of chunk.powerups) {
      expect(p.position[1]).toBeGreaterThan(30);
      expect(["magnet", "thruster"]).toContain(p.type);
    }
    // Over a tall tower at least one should appear.
    expect(chunk.powerups.length).toBeGreaterThan(0);
  });

  it("starter pad is centered, large, standard", () => {
    const s = starterPad();
    expect(s.position).toEqual([0, 0, 0]);
    expect(s.type).toBe("standard");
    expect(s.width).toBeGreaterThan(7);
  });

  // Golden-path navigability: any pad whose successor is laterally far away must be CANTED
  // toward that successor, so the bounce can actually carry the blob onward (the tower is
  // provably climbable, not a grid of unreachable flat pads).
  it("cants a pad toward a laterally-distant next pad (reachable chain)", () => {
    const { trampolines } = generateUpTo(createRng("climb"), 0, 400);
    let cantedCount = 0;
    for (let i = 0; i < trampolines.length - 1; i++) {
      const a = trampolines[i];
      const b = trampolines[i + 1];
      const lateral = Math.hypot(b.position[0] - a.position[0], b.position[2] - a.position[2]);
      if (lateral > 4.5) {
        // Far successor → this pad must be canted toward it.
        expect(a.type).toBe("canted");
        expect(a.cant).toBeDefined();
        const [cx, cz] = a.cant ?? [0, 0];
        const dx = b.position[0] - a.position[0];
        const dz = b.position[2] - a.position[2];
        // Cant points toward the successor (positive dot with the offset) + is a unit vec.
        expect(cx * dx + cz * dz).toBeGreaterThan(0);
        expect(Math.hypot(cx, cz)).toBeCloseTo(1, 5);
        cantedCount++;
      }
    }
    // A spiral-placed tower should produce several canted pads.
    expect(cantedCount).toBeGreaterThan(0);
  });
});
