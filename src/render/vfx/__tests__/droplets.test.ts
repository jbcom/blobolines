import { describe, expect, it } from "vitest";
import { goo as gooCfg } from "@/config";
import { createRng } from "@/core/math";
import type { Vec3 } from "@/core/types";
import { spawnLaunchBurst, spawnSplash, spawnTrailDroplet, stepDroplet } from "../droplets";

const ORIGIN: Vec3 = [0, 5, 0];

describe("spawnSplash", () => {
  it("scales droplet count with impact strength", () => {
    const weak = spawnSplash(ORIGIN, 0.2, createRng(1));
    const strong = spawnSplash(ORIGIN, 1, createRng(1));
    expect(strong.length).toBeGreaterThan(weak.length);
  });

  it("caps the droplet count at the configured maxCount", () => {
    expect(spawnSplash(ORIGIN, 100, createRng(1)).length).toBeLessThanOrEqual(
      gooCfg.splash.maxCount,
    );
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

describe("spawnLaunchBurst", () => {
  it("kicks droplets downward off the pad", () => {
    const ds = spawnLaunchBurst(ORIGIN, 1, createRng(5));
    expect(ds.length).toBeGreaterThan(0);
    // Downward bias: every droplet starts with vy <= 0 (opposite of a splash).
    for (const d of ds) expect(d.velocity[1]).toBeLessThanOrEqual(0);
  });

  it("scales droplet count with charge", () => {
    const weak = spawnLaunchBurst(ORIGIN, 0, createRng(1));
    const strong = spawnLaunchBurst(ORIGIN, 1, createRng(1));
    expect(strong.length).toBeGreaterThan(weak.length);
  });

  it("is deterministic per seed", () => {
    expect(spawnLaunchBurst(ORIGIN, 1, createRng(9))).toEqual(
      spawnLaunchBurst(ORIGIN, 1, createRng(9)),
    );
  });
});

describe("spawnTrailDroplet", () => {
  const DIR: Vec3 = [0, 1, 0];

  it("lags behind the blob (velocity opposes travel direction)", () => {
    // With near-zero jitter dominance: a fast blob's trail droplet should drift back.
    let backward = 0;
    for (let i = 0; i < 20; i++) {
      const d = spawnTrailDroplet(ORIGIN, DIR, 20, createRng(i + 1));
      if (d.velocity[1] < 0) backward++;
    }
    // The -dir*speed*0.15 term (≈ -0.6) dominates the ±0.6 jitter most of the time.
    expect(backward).toBeGreaterThan(10);
  });

  it("spawns a single short-lived droplet near the origin", () => {
    const d = spawnTrailDroplet(ORIGIN, DIR, 10, createRng(2));
    expect(d.life).toBeLessThan(0.7);
    expect(Math.abs(d.position[0] - ORIGIN[0])).toBeLessThan(0.5);
    expect(Math.abs(d.position[2] - ORIGIN[2])).toBeLessThan(0.5);
  });

  it("is deterministic per seed", () => {
    expect(spawnTrailDroplet(ORIGIN, DIR, 12, createRng(4))).toEqual(
      spawnTrailDroplet(ORIGIN, DIR, 12, createRng(4)),
    );
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
