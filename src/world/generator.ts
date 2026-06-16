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

const TYPE_BAG: TrampType[] = ["standard", "standard", "standard", "booster", "moving", "fragile"];

/**
 * Generate trampolines (and crystals) from `fromY` up to at least `targetY`.
 * The first pads (low) are always `standard` so the start is forgiving.
 */
export function generateUpTo(rng: Rng, fromY: number, targetY: number): GeneratedChunk {
  const trampolines: TrampolineSpec[] = [];
  const crystals: Vec3[] = [];
  const powerups: PowerUpSpec[] = [];
  let y = fromY;

  while (y < targetY) {
    const stepY = 7.5 + rng.next() * 6.8;
    y += stepY;

    // Spiral placement: angle advances with height, radius gently oscillates.
    const angle = y * 0.08 + rng.next() * 0.65;
    const radius = 2 + Math.sin(y * 0.04) * 6;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;

    // Difficulty: pads shrink with altitude.
    const diff = Math.max(0.4, 1 - y / 650);
    const width = (5.8 + rng.next() * 2.8) * diff;
    const depth = (5.8 + rng.next() * 2.8) * diff;

    const type: TrampType = y < 25 ? "standard" : rng.pick(TYPE_BAG);

    // id = the pad's generation Y (strictly increasing across the whole tower → unique).
    trampolines.push({ id: y, position: [x, y, z], width, depth, type });

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
