import seedrandom from "seedrandom";

/**
 * Deterministic RNG facade. The whole sim seeds from this, so all procedural gameplay and
 * replay verification share one implementation instead of a local hash + PRNG mix.
 *
 * Seeding is deliberately two-layered:
 * 1. A player-visible seed phrase, usually adjective-adjective-noun, is canonicalized.
 * 2. seedrandom.xor4096 derives the numeric id and all stream values from that phrase.
 *
 * Normal new games generate a fresh phrase; replay/dev/daily paths pass an explicit phrase.
 */

export type SeedInput = number | string;

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
  /** +/-1 sign. */
  sign(): 1 | -1;
  /** Reset the stream back to the original seed. */
  reset(): void;
  /** The numeric seed id in use. */
  readonly seed: number;
  /** The canonical phrase/input that produced this stream. */
  readonly phrase: string;
}

const RNG_NS = "blobolines:rng";
const SEED_ID_NS = "blobolines:seed-id";
const PHRASE_NS = "blobolines:seed-phrase";
const NUMERIC_SEED = /^seed-([0-9a-z]+)$/;

const FIRST_ADJECTIVES = [
  "bouncy",
  "bubbly",
  "candy",
  "cheery",
  "cosmic",
  "dizzy",
  "electric",
  "floaty",
  "glimmer",
  "gooey",
  "happy",
  "jelly",
  "lucky",
  "melty",
  "merry",
  "neon",
  "peppy",
  "plucky",
  "poppy",
  "springy",
  "sunny",
  "tangy",
  "twisty",
  "zippy",
] as const;

const SECOND_ADJECTIVES = [
  "amber",
  "bright",
  "charmed",
  "coral",
  "daring",
  "dreamy",
  "fizzy",
  "golden",
  "juicy",
  "kind",
  "lively",
  "loopy",
  "minty",
  "nimble",
  "plush",
  "prismatic",
  "radiant",
  "rosy",
  "silky",
  "snappy",
  "sparkly",
  "squishy",
  "tasty",
  "wiggly",
] as const;

const NOUNS = [
  "bean",
  "blob",
  "bounce",
  "bubble",
  "button",
  "comet",
  "dollop",
  "drop",
  "flubber",
  "gumdrop",
  "jelly",
  "jumper",
  "marble",
  "mote",
  "noodle",
  "orbit",
  "pebble",
  "pogo",
  "puddle",
  "rocket",
  "skipper",
  "splash",
  "spring",
  "star",
  "tumble",
  "whirl",
  "wobble",
  "zest",
] as const;

/** Convert free-form seed text into the canonical replay phrase. */
export function canonicalSeedPhrase(seed: string): string {
  return (
    seed
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .replace(/-{2,}/g, "-") || "seed-empty"
  );
}

/** Numeric seeds keep exact legacy semantics while still having a replayable phrase form. */
export function numericSeedPhrase(seed: number): string {
  return `seed-${(seed >>> 0).toString(36)}`;
}

function seedPhrase(seed: SeedInput): string {
  return typeof seed === "number" ? numericSeedPhrase(seed) : canonicalSeedPhrase(seed);
}

function numericFromPhrase(phrase: string): number | null {
  const match = NUMERIC_SEED.exec(phrase);
  if (!match) return null;
  return Number.parseInt(match[1], 36) >>> 0;
}

/** Normalize any seed input to an unsigned 32-bit id. */
export function normalizeSeed(seed: SeedInput): number {
  if (typeof seed === "number") return seed >>> 0;
  const phrase = canonicalSeedPhrase(seed);
  const numeric = numericFromPhrase(phrase);
  if (numeric !== null) return numeric;
  return seedrandom.xor4096(`${SEED_ID_NS}:${phrase}`).int32() >>> 0;
}

function prngInt(prng: seedrandom.PRNG, maxExclusive: number): number {
  return Math.floor(prng() * maxExclusive);
}

function pickShuffled<T>(items: readonly T[], prng: seedrandom.PRNG): T {
  const bag = [...items];
  for (let i = bag.length - 1; i > 0; i--) {
    const j = prngInt(prng, i + 1);
    [bag[i], bag[j]] = [bag[j] as T, bag[i] as T];
  }
  return bag[0] as T;
}

/**
 * Fresh adjective-adjective-noun phrase for a new run. With an explicit entropy value this is
 * deterministic (tests/tools); without one seedrandom autoseeds so menu New Game gets variety.
 */
export function createSeedPhrase(entropy?: SeedInput): string {
  const selector =
    entropy === undefined
      ? seedrandom.xor4096(undefined, { entropy: true })
      : seedrandom.xor4096(`${PHRASE_NS}:select:${seedPhrase(entropy)}`);
  const shuffleSeed = [selector.int32() >>> 0, selector.int32() >>> 0, selector.int32() >>> 0].join(
    ":",
  );
  const shuffle = seedrandom.xor4096(`${PHRASE_NS}:shuffle:${shuffleSeed}`);

  const first = pickShuffled(FIRST_ADJECTIVES, shuffle);
  let second = pickShuffled(SECOND_ADJECTIVES, shuffle);
  if (second === first) {
    second = SECOND_ADJECTIVES.find((word) => word !== first) ?? second;
  }
  const noun = pickShuffled(NOUNS, shuffle);
  return `${first}-${second}-${noun}`;
}

/** Create a deterministic RNG from a numeric seed or phrase. */
export function createRng(seed: SeedInput): Rng {
  const phrase = seedPhrase(seed);
  const base = normalizeSeed(phrase);
  const createStream = () => seedrandom.xor4096(`${RNG_NS}:${phrase}`);
  let stream = createStream();

  const next = (): number => stream();

  return {
    next,
    range: (min, max) => {
      if (max < min) throw new Error(`createRng.range: max (${max}) < min (${min})`);
      return min + next() * (max - min);
    },
    int: (min, max) => {
      if (max < min) throw new Error(`createRng.int: max (${max}) < min (${min})`);
      return min + Math.floor(next() * (max - min + 1));
    },
    bool: (p = 0.5) => next() < p,
    pick: (items) => {
      if (items.length === 0) throw new Error("createRng.pick: empty array");
      return items[Math.floor(next() * items.length)] as (typeof items)[number];
    },
    sign: () => (next() < 0.5 ? -1 : 1),
    reset: () => {
      stream = createStream();
    },
    seed: base,
    phrase,
  };
}
