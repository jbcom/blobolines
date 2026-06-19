import type { Rng } from "@/core/math";
import type { TrampType } from "@/core/types";

/**
 * Altitude-weighted pad-type distribution (pure, seeded). A flat type bag made the tower feel
 * the same at 20m and 600m; instead the mix EVOLVES with height:
 *   - low: mostly safe standard pads, a little booster — a forgiving, learnable start.
 *   - mid: the full toolkit comes online (moving, ice, fragile) — variety + first challenge.
 *   - high: bonus + skill types get richer (super/booster/ice/wobbler weighted up, plain
 *     standard thinned) — the climb earns flashier, riskier pads as it gets harder.
 * `canted` is never rolled here — the generator promotes pads to canted for reachability.
 */

/** Per-type weight at a given altitude. Weights are blended across the bands below. */
type Weights = Partial<Record<TrampType, number>>;

interface Band {
  /** Altitude (m) at which this band's weights fully apply. */
  y: number;
  weights: Weights;
}

// Control points; weights are linearly interpolated between adjacent bands by altitude.
const BANDS: Band[] = [
  {
    y: 25,
    weights: { standard: 6, booster: 1.5, moving: 0.5 },
  },
  {
    y: 150,
    weights: {
      standard: 4,
      booster: 1.5,
      moving: 1.5,
      fragile: 1,
      ice: 1,
      super: 0.4,
      bubble: 0.8,
    },
  },
  {
    y: 450,
    weights: {
      standard: 2.5,
      booster: 2,
      moving: 1.5,
      fragile: 1.5,
      ice: 1.5,
      wobbler: 1.5,
      super: 0.8,
      storm: 1.0,
      vortex: 1.2,
      bubble: 1.2,
    },
  },
];

// The bracketing interpolation in weightsAt relies on bands being STRICTLY increasing in y.
// Assert it once at module load so an out-of-order edit fails loudly instead of silently
// selecting the wrong interval (the latent fragility flagged in review).
for (let i = 1; i < BANDS.length; i++) {
  if (BANDS[i].y <= BANDS[i - 1].y) {
    throw new Error(`padType BANDS must be strictly increasing in y (index ${i})`);
  }
}

const ALL_TYPES: TrampType[] = [
  "standard",
  "booster",
  "moving",
  "fragile",
  "ice",
  "wobbler",
  "super",
  "storm",
  "vortex",
  "bubble",
];

/** Linearly interpolate the weight table at altitude `y` between the bracketing bands. */
function weightsAt(y: number): Weights {
  if (y <= BANDS[0].y) return BANDS[0].weights;
  const last = BANDS[BANDS.length - 1];
  if (y >= last.y) return last.weights;
  let lo = BANDS[0];
  let hi = last;
  for (let i = 0; i < BANDS.length - 1; i++) {
    if (y >= BANDS[i].y && y <= BANDS[i + 1].y) {
      lo = BANDS[i];
      hi = BANDS[i + 1];
      break;
    }
  }
  const t = (y - lo.y) / (hi.y - lo.y);
  const out: Weights = {};
  for (const type of ALL_TYPES) {
    const a = lo.weights[type] ?? 0;
    const b = hi.weights[type] ?? 0;
    const w = a + (b - a) * t;
    if (w > 0) out[type] = w;
  }
  return out;
}

/**
 * Pick a pad type for altitude `y` using the blended weight table. Deterministic given `rng`.
 * Falls back to "standard" if (impossibly) every weight is zero.
 */
export function pickPadType(rng: Rng, y: number): TrampType {
  const weights = weightsAt(y);
  let total = 0;
  for (const type of ALL_TYPES) total += weights[type] ?? 0;
  if (total <= 0) return "standard";
  let roll = rng.next() * total;
  for (const type of ALL_TYPES) {
    roll -= weights[type] ?? 0;
    if (roll < 0) return type;
  }
  return "standard";
}

/** Exposed for tests: the (normalized) probability of a type at an altitude. */
export function padTypeWeights(y: number): Weights {
  return weightsAt(y);
}
