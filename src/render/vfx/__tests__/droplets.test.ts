import { describe, expect, it } from "vitest";
import { createRng } from "@/core/math";
import type { Vec3 } from "@/core/types";
import { spawnSplash, stepDroplet } from "../droplets";

const ORIGIN: Vec3 = [0, 5, 0];

describe("spawnSplash", () => {
  it("scales droplet count with impact strength", () => {
    const weak = spawnSplash(ORIGIN, 0.2, createRng(1));
    const strong = spawnSplash(ORIGIN, 1, createRng(1));
    expect(strong.length).toBeGreaterThan(weak.length);
  });

  it("caps the droplet count", () => {
    expect(spawnSplash(ORIGIN, 100, createRng(1)).length).toBeLessThanOrEqual(18);
  });

  it("is deterministic per seed", () => {
    expect(spawnSplash(ORIGIN, 1, createRng(7))).toEqual(spawnSplash(ORIGIN, 1, createRng(7)));
  });

  it("flings droplets upward and outward", () => {
    const ds = spawnSplash(ORIGIN, 1, createRng(3));
    expect(ds.length).toBeGreaterThan(0);
    // Hemisphere biased up: every droplet starts with vy >= 0.
    for (const d of ds) expect(d.velocity[1]).toBeGreaterThanOrEqual(0);
    // At least some lateral spread.
    expect(ds.some((d) => Math.abs(d.velocity[0]) + Math.abs(d.velocity[2]) > 0.5)).toBe(true);
  });
});

describe("stepDroplet", () => {
  it("falls under gravity and expires", () => {
    let d = spawnSplash(ORIGIN, 1, createRng(2))[0];
    let alive = 0;
    while (d) {
      const next = stepDroplet(d, 1 / 60, -22);
      if (!next) break;
      d = next;
      alive++;
      if (alive > 10_000) throw new Error("droplet never expired");
    }
    expect(alive).toBeGreaterThan(0);
  });

  it("applies gravity to vertical velocity", () => {
    const d = spawnSplash(ORIGIN, 1, createRng(4))[0];
    const next = stepDroplet(d, 0.1, -22);
    expect(next).not.toBeNull();
    if (next) expect(next.velocity[1]).toBeLessThan(d.velocity[1]);
  });
});
