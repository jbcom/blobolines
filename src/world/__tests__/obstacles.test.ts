import { describe, expect, it } from "vitest";
import { createRng } from "@/core/math";
import type { Vec3 } from "@/core/types";
import { generateUpTo, starterPad } from "../generator";
import { generateObstacles, ROUTE_CLEARANCE } from "../obstacles";

function dist3(a: Vec3, b: Vec3) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

/** Build a real tower + its obstacles for a seed. */
function world(seed: string, toY = 600) {
  const rng = createRng(seed);
  const start = starterPad();
  const chunk = generateUpTo(rng, 0, toY, start);
  const pads = [start, ...chunk.trampolines];
  const obstacles = generateObstacles(createRng(`${seed}-obs`), pads, 0, toY);
  return { pads, obstacles };
}

describe("off-route obstacles", () => {
  it("is deterministic for the same seed", () => {
    const a = world("obs-seed-1").obstacles;
    const b = world("obs-seed-1").obstacles;
    expect(a).toEqual(b);
  });

  it("INVARIANT: no obstacle sits within the flight corridor of any certified golden arc", () => {
    // This is the climbability guarantee: the golden-path `samples` ARE the blob's flight line, so
    // every obstacle must stay ≥ ROUTE_CLEARANCE from ALL of them across many seeds — otherwise an
    // obstacle could block a proven pad-to-pad reach. (reaches()/the proofs are the single source of
    // truth; this asserts the obstacle placer respects them.)
    for (const seed of ["a1", "b2", "c3", "d4", "e5", "seed-x", "bouncy-bright-blob"]) {
      const { pads, obstacles } = world(seed, 900);
      expect(obstacles.length, `seed ${seed} should place at least one obstacle`).toBeGreaterThan(
        0,
      );
      for (const obs of obstacles) {
        for (const pad of pads) {
          const proof = pad.goldenPath;
          if (!proof) continue;
          for (const s of proof.samples) {
            expect(
              dist3(obs.position, s),
              `seed ${seed}: obstacle ${obs.id} too close to a golden arc sample`,
            ).toBeGreaterThanOrEqual(ROUTE_CLEARANCE);
          }
        }
      }
    }
  });

  it("keeps obstacles out of pad footprints and apart from each other", () => {
    const { pads, obstacles } = world("spacing-seed", 700);
    for (const obs of obstacles) {
      // Not inside any pad footprint (half-extent + a margin).
      for (const pad of pads) {
        const half = Math.max(pad.width, pad.depth) * 0.5;
        expect(dist3(obs.position, pad.position)).toBeGreaterThan(half);
      }
      // No two obstacles coincide.
      const dupes = obstacles.filter((o) => o !== obs && dist3(o.position, obs.position) < 1);
      expect(dupes.length).toBe(0);
    }
  });

  it("only places obstacles for pads within [fromY, toY)", () => {
    const rng = createRng("range-seed");
    const start = starterPad();
    const pads = [start, ...generateUpTo(rng, 0, 800, start).trampolines];
    const obstacles = generateObstacles(createRng("range-obs"), pads, 300, 600);
    for (const obs of obstacles) {
      expect(obs.id).toBeGreaterThanOrEqual(300);
      expect(obs.id).toBeLessThan(600);
    }
  });
});
