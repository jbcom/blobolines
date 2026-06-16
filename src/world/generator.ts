import type { Rng } from "@/core/math";
import type { PowerUpType, TrampolineSpec, TrampType, Vec3 } from "@/core/types";

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
/** Lateral offset (world units) beyond which a flat straight-up bounce can't reach the next
 *  pad, so the CURRENT pad is canted toward it — the golden-path guarantee that every pad
 *  has a launch that carries the blob onward. Below this, a flat pad + air-steer suffices. */
const CANT_REACH = 4.5;

export function generateUpTo(rng: Rng, fromY: number, targetY: number): GeneratedChunk {
  const trampolines: TrampolineSpec[] = [];
  const crystals: Vec3[] = [];
  const powerups: PowerUpSpec[] = [];
  let y = fromY;
  /** Previous pad, so we can cant it toward this one (golden-path reachability). */
  let prev: TrampolineSpec | null = null;

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
    const width = (5.8 + rng.next() * 2.8) * diff;
    const depth = (5.8 + rng.next() * 2.8) * diff;

    let type: TrampType = y < 25 ? "standard" : rng.pick(TYPE_BAG);

    // GOLDEN PATH: every pad must be reachable from its predecessor. If this pad is laterally
    // far from the previous one, either (forgiving start, prev below y=25) PULL it into flat-
    // bounce reach so the early pads stay flat + easy, or (above the start) CANT the previous
    // pad toward it so its bounce throws the blob here. Reachability beats pad variety, so
    // canting overrides whatever special type the previous pad rolled.
    if (prev) {
      let dx = x - prev.position[0];
      let dz = z - prev.position[2];
      const lateral = Math.hypot(dx, dz);
      if (lateral > CANT_REACH) {
        if (prev.position[1] < 25) {
          // Forgiving zone: clamp this pad into reach of the (flat) previous pad.
          const k = CANT_REACH / lateral;
          x = prev.position[0] + dx * k;
          z = prev.position[2] + dz * k;
          dx = x - prev.position[0];
          dz = z - prev.position[2];
        } else {
          // Cant the previous pad toward this one (override its type — reachability first).
          prev.type = "canted";
          const m = Math.hypot(dx, dz) || 1;
          (prev as { cant?: readonly [number, number] }).cant = [dx / m, dz / m];
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

  return { trampolines, crystals, powerups, highestY: y };
}

/** The fixed starting pad (large, centered, standard) the blob begins on. */
export function starterPad(): TrampolineSpec {
  return { id: 0, position: [0, 0, 0], width: 7.5, depth: 7.5, type: "standard" };
}
