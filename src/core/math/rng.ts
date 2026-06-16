/**
 * Deterministic RNG facade. The whole sim seeds from this — never `Math.random()`
 * (gates.json bans it in src/sim) so a given seed always replays identically.
 *
 * cyrb128 hashes a string/number seed into 4×32-bit state; mulberry32 is the stream.
 * Pattern adapted from arcade-cabinet (infinite-headaches/src/random/seedrandom.ts).
 */

export interface Rng {
  /** Float in [0, 1). */
  next(): number;
  /** Float in [min, max). */
  range(min: number, max: number): number;
  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number;
  /** True with probability p (default 0.5). */
  bool(p?: number): boolean;
  /** Random element of a non-empty array. */
  pick<T>(items: readonly T[]): T;
  /** ±1 sign. */
  sign(): 1 | -1;
  /** Reset the stream back to the original seed. */
  reset(): void;
  /** The numeric seed in use. */
  readonly seed: number;
}

/** cyrb128 — string → 4×32-bit hash (good seed spread). */
function cyrb128(str: string): number {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;
  for (let i = 0; i < str.length; i++) {
    const k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  return (h1 ^ h2 ^ h3 ^ h4) >>> 0;
}

/** Normalize any seed (number or string) to an unsigned 32-bit integer. */
export function normalizeSeed(seed: number | string): number {
  if (typeof seed === "number") return seed >>> 0;
  return cyrb128(seed);
}

/** Create a deterministic RNG from a numeric or string seed. */
export function createRng(seed: number | string): Rng {
  const base = normalizeSeed(seed);
  let state = base;

  const next = (): number => {
    state = (state + 0x6d2b79f5) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    range: (min, max) => min + next() * (max - min),
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    bool: (p = 0.5) => next() < p,
    pick: (items) => items[Math.floor(next() * items.length)] as (typeof items)[number],
    sign: () => (next() < 0.5 ? -1 : 1),
    reset: () => {
      state = base;
    },
    seed: base,
  };
}
