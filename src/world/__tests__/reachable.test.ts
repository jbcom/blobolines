import { describe, expect, it } from "vitest";
import { trampoline as trampCfg } from "@/config";
import { createRng } from "@/core/math";
import { DEFAULT_STEER } from "@/input";
import { GRAVITY } from "@/sim/physics";
import { generateUpTo, starterPad } from "../generator";
import { canReach } from "../reachable";

/**
 * The CLIMB PROOF — the playability safety net the navigability work exists to guarantee.
 *
 * The golden-path generator promises the tower is climbable: every pad has a launch that
 * carries the blob to the next one. generator.test.ts proves the *placement* rule (far
 * successors get a canted predecessor pointing at them); this proves that placement is
 * *sufficient* — a ballistic launch off each pad, along its surface normal at an achievable
 * launch speed, actually lands within the next pad's footprint. If a future tuning change
 * (tilt, multipliers, step heights) silently broke reachability, this test goes red.
 *
 * Model (conservative — treats the blob as a passive point, ignores air-steer, which only
 * helps): launch off pad A at `speed` along A's normal under gravity g; can it reach B?
 */

const G = Math.abs(GRAVITY[1]);
const TILT = trampCfg.cantedTiltRad;
// The same lateral air-control budget the game gives the player (src/input DEFAULT_STEER).
// The golden-path generator only cants pads whose successor is beyond this steerable range;
// sub-cant gaps are meant to be closed by the player nudging mid-air, so the climb proof
// must model that budget too (passing 0 would test a stricter game than we ship).
const STEER = DEFAULT_STEER.maxAirSpeed;

// A representative sustained climbing launch speed: a clean drop onto a slightly-springy
// standard pad plus the player's slingshot keeps the blob moving up at roughly this rate.
// (canReach is monotone in speed once the arc clears B's height, so this is the threshold a
// competent player meets — not a flagged maximum.)
const CLIMB_SPEED = 30;

function fullTower(seed: string | number, targetY: number) {
  const start = starterPad();
  const chunk = generateUpTo(createRng(seed), 0, targetY, start);
  return [start, ...chunk.trampolines];
}

describe("tower is climbable (reachability proof)", () => {
  it("canted pads do the lateral work their flat selves couldn't", () => {
    // A pad is canted precisely BECAUSE a flat bounce off it can't reach its successor. So
    // for every canted pad: (a) flattening it would FAIL the reach (the cant is load-bearing,
    // not decoration), and (b) the canted launch DOES reach (with the player's steer budget).
    const pads = fullTower("climb", 400);
    let cantedPairs = 0;
    for (let i = 0; i < pads.length - 1; i++) {
      const a = pads[i];
      if (a.type !== "canted") continue;
      cantedPairs++;
      const b = pads[i + 1];
      const flat = { ...a, type: "standard" as const, cant: undefined };
      expect(
        canReach(flat, b, CLIMB_SPEED, G, TILT, STEER),
        `pad #${i} was canted but a flat bounce already reached — needless cant`,
      ).toBe(false);
      expect(
        canReach(a, b, CLIMB_SPEED, G, TILT, STEER),
        `canted pad #${i} at y=${a.position[1].toFixed(1)} still cannot reach its successor`,
      ).toBe(true);
    }
    // A spiral tower this tall must produce canted pads — otherwise there's nothing to prove
    // and the navigability guarantee is vacuous.
    expect(cantedPairs).toBeGreaterThan(0);
  });

  it("the whole chain is reachable end to end (no stranded pad)", () => {
    const pads = fullTower("endtoend", 500);
    const unreachable: number[] = [];
    for (let i = 0; i < pads.length - 1; i++) {
      if (!canReach(pads[i], pads[i + 1], CLIMB_SPEED, G, TILT, STEER)) unreachable.push(i);
    }
    expect(unreachable, `stranded pad indices: ${unreachable.join(", ")}`).toEqual([]);
  });

  it("holds across many seeds (the guarantee isn't seed-luck)", () => {
    for (const seed of ["a", "b", "c", "d", "e"]) {
      const pads = fullTower(seed, 300);
      for (let i = 0; i < pads.length - 1; i++) {
        expect(
          canReach(pads[i], pads[i + 1], CLIMB_SPEED, G, TILT, STEER),
          `seed ${seed}: pad #${i} (y=${pads[i].position[1].toFixed(1)}) strands the climb`,
        ).toBe(true);
      }
    }
  });
});
