import { create } from "zustand";
import { world as worldCfg } from "@/config";
import { createRng, type Rng } from "@/core/math";
import type { CrystalSpec, TrampolineSpec, WorldDifficulty } from "@/core/types";
import { generateUpTo, type PowerUpSpec, starterPad } from "@/world";

/**
 * Runtime store for the generated tower. Separate from the UI store (useGameStore):
 * this holds the procedurally generated trampolines/crystals/power-ups and extends them
 * as the blob climbs. Lives in zustand so the R3F field renderers re-render when new
 * chunks are appended.
 */

interface WorldState {
  seed: number;
  difficulty: WorldDifficulty;
  trampolines: TrampolineSpec[];
  crystals: CrystalSpec[];
  powerups: PowerUpSpec[];
  highestY: number;
  /** Last pad placed — threaded into the next generateUpTo so the golden-path cant reaches
   *  across chunk boundaries (no unreachable pad at the seam). */
  lastPad: TrampolineSpec | null;
  rng: Rng;

  /** Reset to a fresh tower for a new run (optionally with a given seed). */
  reset: (seed?: number, difficulty?: WorldDifficulty) => void;
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

function freshTower(seed: number, difficulty: WorldDifficulty) {
  const rng = createRng(seed);
  const start = starterPad();
  // Thread the starter pad in as prev so the first generated pad is reachable from it too.
  const chunk = generateUpTo(rng, 0, INITIAL_TARGET, start, difficulty);
  return {
    rng,
    difficulty,
    trampolines: [start, ...chunk.trampolines],
    crystals: chunk.crystals,
    powerups: chunk.powerups,
    highestY: chunk.highestY,
    lastPad: chunk.lastPad,
  };
}

export const useWorldStore = create<WorldState>((set, get) => ({
  seed: 1,
  ...freshTower(1, "ready"),

  reset: (seed, difficulty) => {
    // Deterministic next seed (not performance.now() — that was non-reproducible and
    // violated the determinism doctrine): advance the previous seed by an LCG step so each
    // run gets a fresh-but-replayable tower. Pass an explicit seed for a fixed/daily run.
    const s = seed ?? ((get().seed * 1664525 + 1013904223) >>> 0 || 1);
    const d = difficulty ?? get().difficulty;
    set({ seed: s, ...freshTower(s, d) });
  },

  setDifficulty: (difficulty) => set({ difficulty }),

  ensureHeight: (targetY) => {
    const { highestY, rng, trampolines, crystals, powerups, lastPad, difficulty } = get();
    if (targetY <= highestY) return;
    // Thread lastPad in so the first pad of this chunk gets a canted predecessor if it lands
    // far — no unreachable pad at the chunk seam.
    const chunk = generateUpTo(rng, highestY, targetY, lastPad, difficulty);
    // Retain only the recent tail of each list — entries far below are unreachable (the
    // blob dies after falling a fixed distance), so they'd only leak memory on a long
    // climb. Trampolines are also render-windowed; this bounds the underlying store too.
    set({
      trampolines: tail([...trampolines, ...chunk.trampolines], MAX_RETAINED_TRAMPS),
      crystals: [...crystals, ...chunk.crystals],
      powerups: [...powerups, ...chunk.powerups],
      highestY: chunk.highestY,
      lastPad: chunk.lastPad,
    });
  },
}));
