import type { Rng } from "@/core/math";
import type { PowerUpType, TrampolineSpec, TrampType, Vec3 } from "@/core/types";
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

// `super` is the rare bonus mega-launch pad — one slot so it's a treat, not the norm.
const TYPE_BAG: TrampType[] = [
  "standard",
  "standard",
  "standard",
  "booster",
  "moving",
  "fragile",
  "super",
  "ice",
  "wobbler",
];

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

    let type: TrampType = y < 25 ? "standard" : rng.pick(TYPE_BAG);

    // GOLDEN PATH: every pad must be reachable from its predecessor. If this pad is laterally
    // far from the previous one, either (forgiving start, prev below y=25) PULL it into flat-
    // bounce reach so the early pads stay flat + easy, or (above the start) CANT the previous
    // pad toward it so its bounce throws the blob here. Reachability beats pad variety, so
    // canting overrides whatever special type the previous pad rolled.
    // GOLDEN-PATH REACHABILITY: build a candidate for this pad, then GUARANTEE the previous
    // pad can launch the blob to it. `reaches()` is the shipped-tuning predicate (launch
    // speed, gravity, canted tilt, steer budget) — the same one the climb proof asserts, so
    // the placement rule and the playability check can't drift. If the flat previous pad
    // can't reach: in the forgiving start (prev below y=25) PULL this pad inward so the early
    // pads stay flat + easy; otherwise CANT the previous pad toward it (overriding whatever
    // special type it rolled — reachability beats variety).
    if (prev) {
      let candidate: TrampolineSpec = { id: y, position: [x, y, z], width, depth, type };
      if (!reaches(prev, candidate)) {
        const dx = x - prev.position[0];
        const dz = z - prev.position[2];
        const lateral = Math.hypot(dx, dz) || 1;
        if (prev.position[1] < 25) {
          // Forgiving zone: pull this pad straight toward prev until the flat bounce reaches.
          // Step inward in fractions; the footprint guarantees a small number of steps lands.
          for (let k = 0.85; k > 0.05 && !reaches(prev, candidate); k -= 0.15) {
            x = prev.position[0] + dx * k;
            z = prev.position[2] + dz * k;
            candidate = { id: y, position: [x, y, z], width, depth, type };
          }
        } else {
          // Cant prev toward this pad (override its type — reachability first), then verify.
          prev.type = "canted";
          (prev as { cant?: readonly [number, number] }).cant = [dx / lateral, dz / lateral];
        }
      }
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
