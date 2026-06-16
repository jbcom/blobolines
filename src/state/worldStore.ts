import { create } from "zustand";
import { createRng, type Rng } from "@/core/math";
import type { TrampolineSpec, Vec3 } from "@/core/types";
import { generateUpTo, starterPad } from "@/world";

/**
 * Runtime store for the generated tower. Separate from the UI store (useGameStore):
 * this holds the procedurally generated trampolines/crystals and extends them as the
 * blob climbs. Lives in zustand so the R3F field renderer re-renders when new chunks
 * are appended.
 */

interface WorldState {
  seed: number;
  trampolines: TrampolineSpec[];
  crystals: Vec3[];
  highestY: number;
  rng: Rng;

  /** Reset to a fresh tower for a new run (optionally with a given seed). */
  reset: (seed?: number) => void;
  /** Ensure the tower is generated at least up to `targetY`. */
  ensureHeight: (targetY: number) => void;
}

const INITIAL_TARGET = 180;

function freshTower(seed: number) {
  const rng = createRng(seed);
  const chunk = generateUpTo(rng, 0, INITIAL_TARGET);
  return {
    rng,
    trampolines: [starterPad(), ...chunk.trampolines],
    crystals: chunk.crystals,
    highestY: chunk.highestY,
  };
}

export const useWorldStore = create<WorldState>((set, get) => ({
  seed: 1,
  ...freshTower(1),

  reset: (seed) => {
    const s = seed ?? Math.floor(performance.now()) >>> 0;
    set({ seed: s, ...freshTower(s) });
  },

  ensureHeight: (targetY) => {
    const { highestY, rng, trampolines, crystals } = get();
    if (targetY <= highestY) return;
    const chunk = generateUpTo(rng, highestY, targetY);
    set({
      trampolines: [...trampolines, ...chunk.trampolines],
      crystals: [...crystals, ...chunk.crystals],
      highestY: chunk.highestY,
    });
  },
}));
