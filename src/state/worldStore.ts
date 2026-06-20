import { create } from "zustand";
import { world as worldCfg } from "@/config";
import { createRng, createSeedPhrase, type Rng, type SeedInput } from "@/core/math";
import type { CrystalSpec, TrampolineSpec, WorldDifficulty } from "@/core/types";
import {
  generateObstacles,
  generateUpTo,
  type ObstacleSpec,
  type PowerUpSpec,
  starterPad,
} from "@/world";

/**
 * Runtime store for the generated tower. Separate from the UI store (useGameStore):
 * this holds the procedurally generated trampolines/crystals/power-ups and extends them
 * as the blob climbs. Lives in zustand so the R3F field renderers re-render when new
 * chunks are appended.
 */

interface WorldState {
  seed: number;
  seedPhrase: string;
  runId: number;
  difficulty: WorldDifficulty;
  trampolines: TrampolineSpec[];
  crystals: CrystalSpec[];
  powerups: PowerUpSpec[];
  /** Off-route bounce obstacles (decorative scenery with mass — the blob ricochets off them). Placed
   *  clear of every certified golden arc, so they never block the climb. See src/world/obstacles.ts. */
  obstacles: ObstacleSpec[];
  highestY: number;
  /** Last pad placed — threaded into the next generateUpTo so the golden-path cant reaches
   *  across chunk boundaries (no unreachable pad at the seam). */
  lastPad: TrampolineSpec | null;
  rng: Rng;
  /** Independent RNG stream for off-route obstacles, so obstacle placement never perturbs the
   *  pad/crystal/powerup streams (which draw from `rng`). */
  obstacleRng: Rng;

  /** Reset to a fresh tower for a new run (optionally with a given seed). */
  reset: (seed?: SeedInput, difficulty?: WorldDifficulty) => void;
  /** Update the selected route difficulty without resetting the current tower. */
  setDifficulty: (difficulty: WorldDifficulty) => void;
  /** Ensure the tower is generated at least up to `targetY`. */
  ensureHeight: (targetY: number) => void;
}

const INITIAL_TARGET = worldCfg.initialTarget;
/** Retain only the recent tail of the trampoline list — pads far below are unreachable
 *  (the blob dies after falling DEATH_FALL_DISTANCE) and TrampolineField keys by stable
 *  id, so dropping long-passed pads is safe and bounds the store over a long climb.
 *  (Crystals/powerups are NOT trimmed: their fields sync by array index, so a front-trim
 *  would shift indices and desync; their growth is slow + render-capped — left as-is.) */
const MAX_RETAINED_TRAMPS = worldCfg.maxRetainedTramps;

/** Keep the last `max` items of an append-only list (drops the lowest, long-passed ones). */
function tail<T>(list: T[], max: number): T[] {
  return list.length > max ? list.slice(list.length - max) : list;
}

function freshTower(seed: SeedInput, difficulty: WorldDifficulty) {
  const rng = createRng(seed);
  // A SEPARATE obstacle stream so adding/removing off-route obstacles never shifts the pad/crystal/
  // powerup placement (which all draw from `rng`). Derived from this run's phrase for replay
  // determinism (same seed → same obstacles) while staying independent of the pad stream.
  const obstacleRng = createRng(`${rng.phrase}-obstacles`);
  const start = starterPad();
  // Thread the starter pad in as prev so the first generated pad is reachable from it too.
  const chunk = generateUpTo(rng, 0, INITIAL_TARGET, start, difficulty);
  const pads = [start, ...chunk.trampolines];
  return {
    rng,
    obstacleRng,
    difficulty,
    trampolines: pads,
    crystals: chunk.crystals,
    powerups: chunk.powerups,
    obstacles: generateObstacles(obstacleRng, pads, 0, chunk.highestY),
    highestY: chunk.highestY,
    lastPad: chunk.lastPad,
  };
}

function resolveSeed(seed: SeedInput | undefined): Pick<WorldState, "seed" | "seedPhrase"> & {
  input: SeedInput;
} {
  const input = seed ?? createSeedPhrase();
  const rng = createRng(input);
  return { input, seed: rng.seed, seedPhrase: rng.phrase };
}

const INITIAL_SEED = resolveSeed("bouncy-bright-blob");

export const useWorldStore = create<WorldState>((set, get) => ({
  seed: INITIAL_SEED.seed,
  seedPhrase: INITIAL_SEED.seedPhrase,
  runId: 0,
  ...freshTower(INITIAL_SEED.input, "ready"),

  reset: (seed, difficulty) => {
    // Normal runs get a fresh replayable phrase; explicit seeds/phrases are fixed replays.
    const s = resolveSeed(seed);
    const d = difficulty ?? get().difficulty;
    set({
      seed: s.seed,
      seedPhrase: s.seedPhrase,
      runId: get().runId + 1,
      ...freshTower(s.input, d),
    });
  },

  setDifficulty: (difficulty) => set({ difficulty }),

  ensureHeight: (targetY) => {
    const {
      highestY,
      rng,
      obstacleRng,
      trampolines,
      crystals,
      powerups,
      obstacles,
      lastPad,
      difficulty,
    } = get();
    if (targetY <= highestY) return;
    // Thread lastPad in so the first pad of this chunk gets a canted predecessor if it lands
    // far — no unreachable pad at the chunk seam.
    const chunk = generateUpTo(rng, highestY, targetY, lastPad, difficulty);
    // Place obstacles for the NEW chunk's pads (each already carries its golden proof), including
    // lastPad so an obstacle near the seam still clears the cross-seam arc. Bounded with the same
    // tail trim as trampolines.
    const chunkPads = lastPad ? [lastPad, ...chunk.trampolines] : chunk.trampolines;
    const newObstacles = generateObstacles(obstacleRng, chunkPads, highestY, chunk.highestY);
    // Retain only the recent tail of each list — entries far below are unreachable (the
    // blob dies after falling a fixed distance), so they'd only leak memory on a long
    // climb. Trampolines are also render-windowed; this bounds the underlying store too.
    set({
      trampolines: tail([...trampolines, ...chunk.trampolines], MAX_RETAINED_TRAMPS),
      crystals: [...crystals, ...chunk.crystals],
      powerups: [...powerups, ...chunk.powerups],
      obstacles: tail([...obstacles, ...newObstacles], MAX_RETAINED_TRAMPS),
      highestY: chunk.highestY,
      lastPad: chunk.lastPad,
    });
  },
}));
