import type { Rng } from "@/core/math";
import type { PowerUpType, TrampolineSpec, TrampType, Vec3 } from "@/core/types";
import { pickPadType } from "./padType";
import { reaches } from "./reachable";

export interface PowerUpSpec {
  position: Vec3;
  type: PowerUpType;
}

/**
 * Procedural vertical world generator (pure, seeded). Produces an endless upward spiral
 * of trampolines — the tower the player climbs. Deterministic given an Rng, so a seed
 * replays the same course. Generation is incremental: call generateUpTo to extend the
 * tower as the blob climbs.
 */

export interface GeneratedChunk {
  trampolines: TrampolineSpec[];
  crystals: Vec3[];
  powerups: PowerUpSpec[];
  /** Highest Y generated so far (feed back as `fromY` next call). */
  highestY: number;
  /** Last pad placed — feed back as `prevPad` next call so the golden-path cant can reach
   *  ACROSS chunk boundaries (otherwise the first pad of each chunk could be unreachable). */
  lastPad: TrampolineSpec | null;
}

/** Below this altitude the start stays forgiving: pads are pulled into a flat-bounce reach
 *  rather than canted, so the first launches are gentle and don't demand the canted mechanic. */
const FORGIVING_Y = 25;

/**
 * Make `pad` reachable from `prev`, mutating `prev` (cant) and/or returning a pad pulled
 * inward, so `reaches(prev, result)` is TRUE on return. Constructive guarantee (see the call
 * site): above the forgiving start we first try canting `prev` toward the pad; if that's still
 * short — or we're in the forgiving start — we pull the pad straight toward `prev`. Because
 * the launch lands dead-on as the lateral gap shrinks to zero, the pull loop always reaches a
 * solution, so the function never returns an unreachable pad.
 */
function ensureReachable(prev: TrampolineSpec, pad: TrampolineSpec): TrampolineSpec {
  if (reaches(prev, pad)) return pad;

  const [px, , pz] = prev.position;
  const revertFlat = () => {
    if (prev.type === "canted") {
      prev.type = "standard";
      (prev as { cant?: readonly [number, number] }).cant = undefined;
    }
  };
  /** Make prev reach `p`: a flat bounce if that already lands (no needless cant that would
   *  overshoot a near-overhead pad), else — above the forgiving start — cant prev straight at
   *  p. Returns whether prev now reaches p. Always leaves prev's cant matching p's position. */
  const aimAt = (p: TrampolineSpec): boolean => {
    revertFlat();
    if (reaches(prev, p)) return true;
    if (prev.position[1] < FORGIVING_Y) return false; // forgiving start stays flat → must pull
    const ax = p.position[0] - px;
    const az = p.position[2] - pz;
    const m = Math.hypot(ax, az) || 1;
    prev.type = "canted";
    (prev as { cant?: readonly [number, number] }).cant = [ax / m, az / m];
    return reaches(prev, p);
  };

  if (aimAt(pad)) return pad;

  // Still short: pull the pad straight toward prev until it's reachable, RE-AIMING at each step
  // (flat-or-cant) so prev always points at the pad's current position — a stale cant would
  // overshoot a pulled-in, near-overhead pad. Shrinking the gap monotonically raises
  // reachability and BOTTOMS OUT AT k=0 (the pad directly above prev: lateral miss = 0, and
  // the vertical step always clears a flat launch at CLIMB_SPEED — max stepY ≈ 14.3, clearance
  // vy²/2g ≈ 20.4), so this provably terminates with reaches() true. The loop MUST reach k=0
  // (>= 0, not > 0) or that guaranteed base case is never tested.
  const dx = pad.position[0] - px;
  const dz = pad.position[2] - pz;
  let result = pad;
  // Descending fractions ending EXACTLY at 0 — the k=0 (directly-overhead) base case must be
  // evaluated, since that's the geometry the termination guarantee rests on.
  for (const k of [0.85, 0.7, 0.55, 0.4, 0.25, 0.1, 0]) {
    result = { ...pad, position: [px + dx * k, pad.position[1], pz + dz * k] };
    if (aimAt(result)) break;
  }
  return result;
}

/**
 * Generate trampolines (and crystals) from `fromY` up to at least `targetY`.
 * The first pads (low) are always `standard` so the start is forgiving.
 */

export function generateUpTo(
  rng: Rng,
  fromY: number,
  targetY: number,
  prevPad: TrampolineSpec | null = null,
): GeneratedChunk {
  const trampolines: TrampolineSpec[] = [];
  const crystals: Vec3[] = [];
  const powerups: PowerUpSpec[] = [];
  let y = fromY;
  /** Previous pad, so we can cant it toward this one (golden-path reachability). Threaded in
   *  from the prior chunk's lastPad so canting reaches across the chunk boundary. */
  let prev: TrampolineSpec | null = prevPad;

  while (y < targetY) {
    const stepY = 7.5 + rng.next() * 6.8;
    y += stepY;

    // Spiral placement: angle advances with height, radius gently oscillates.
    const angle = y * 0.08 + rng.next() * 0.65;
    const radius = 2 + Math.sin(y * 0.04) * 6;
    let x = Math.cos(angle) * radius;
    let z = Math.sin(angle) * radius;

    // Difficulty: pads shrink with altitude.
    const diff = Math.max(0.4, 1 - y / 650);
    let width = (5.8 + rng.next() * 2.8) * diff;
    let depth = (5.8 + rng.next() * 2.8) * diff;
    // Shape variety: ~1 in 4 pads gets a distinct silhouette — a long plank (wide+thin) or a
    // beam (deep+narrow) — so the tower isn't a stack of identical squares (and the footprint
    // affects how you must land). The other axis shrinks to keep the area sane.
    const shapeRoll = rng.next();
    if (shapeRoll > 0.85) {
      width *= 1.55;
      depth *= 0.6;
    } else if (shapeRoll > 0.7) {
      depth *= 1.55;
      width *= 0.6;
    }

    // Forgiving start is always standard; above it the type mix is altitude-weighted (safe
    // low, full toolkit mid, richer bonus/skill types high) — pickPadType owns that curve.
    let type: TrampType = y < FORGIVING_Y ? "standard" : pickPadType(rng, y);

    // GOLDEN-PATH REACHABILITY: GUARANTEE the previous pad can launch the blob to this one.
    // `reaches()` is the shipped-tuning predicate (launch speed, gravity, canted tilt, steer
    // budget) — the SAME one the climb proof asserts, so the placement rule and the
    // playability check can't drift. The fixup is constructive (no silent fall-through):
    //   1. If a flat prev already reaches → leave both alone (variety preserved).
    //   2. Else, above the forgiving start, CANT prev toward this pad (its tilted bounce
    //      throws the blob here), overriding whatever special type it rolled.
    //   3. If it STILL can't reach (cant insufficient for the geometry, or we're in the
    //      forgiving start where pads stay flat), PULL this pad straight toward prev. As the
    //      lateral gap → 0 the launch lands dead-on (miss → 0 ≤ footprint), so this loop
    //      provably terminates WITH reaches() true — the climb is guaranteed by construction,
    //      not merely checked after the fact.
    if (prev) {
      const fixed = ensureReachable(prev, { id: y, position: [x, y, z], width, depth, type });
      x = fixed.position[0];
      z = fixed.position[2];
    }
    // A freshly-placed pad starts flat; the NEXT iteration may cant it toward its successor.
    if (type === "canted") type = "standard";

    // id = the pad's generation Y (strictly increasing across the whole tower → unique).
    const pad: TrampolineSpec = { id: y, position: [x, y, z], width, depth, type };
    trampolines.push(pad);
    prev = pad;

    // ~60% of pads float a crystal above them.
    if (rng.next() > 0.38) {
      crystals.push([
        x + (rng.next() - 0.5) * 2.5,
        y + 3.2 + rng.next() * 2.8,
        z + (rng.next() - 0.5) * 2.5,
      ]);
    }

    // ~12% of pads (above the forgiving start) float a power-up.
    if (y > 30 && rng.next() > 0.88) {
      powerups.push({
        position: [
          x + (rng.next() - 0.5) * 1.5,
          y + 4.5 + rng.next() * 2,
          z + (rng.next() - 0.5) * 1.5,
        ],
        type: rng.bool() ? "magnet" : "thruster",
      });
    }
  }

  return { trampolines, crystals, powerups, highestY: y, lastPad: prev };
}

/** The fixed starting pad (large, centered, standard) the blob begins on. */
export function starterPad(): TrampolineSpec {
  return { id: 0, position: [0, 0, 0], width: 7.5, depth: 7.5, type: "standard" };
}
