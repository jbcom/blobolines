import { create } from "zustand";
import type { BlobSkin, GamePhase, GameSettings, PlayerProgress } from "@/core/types";
import { palette } from "@/styles/tokens";

/**
 * The app/UI state bridge. The DOM overlay (shadcn) reads/writes here; the R3F scene
 * reads it too. Per-frame entity data lives in the koota ECS world, NOT here — this
 * store holds phase, settings, progress, and run-summary values that change at human
 * (not frame) cadence. UI never touches three objects; it goes through this store.
 * Progress + settings persist via Capacitor Preferences (see persistence.ts).
 */

export interface RunStats {
  height: number;
  crystals: number;
  combo: number;
}

export interface GameState {
  phase: GamePhase;
  settings: GameSettings;
  progress: PlayerProgress;
  run: RunStats;

  setPhase: (phase: GamePhase) => void;
  updateSettings: (patch: Partial<GameSettings>) => void;
  setRun: (patch: Partial<RunStats>) => void;
  resetRun: () => void;
  addCrystals: (n: number) => void;
  commitBestHeight: (height: number) => void;
  setSkin: (skin: BlobSkin) => void;
  unlockSkin: (skin: BlobSkin) => void;
}

export const DEFAULT_SETTINGS: GameSettings = {
  masterVolume: 0.8,
  musicEnabled: true,
  slingshotSensitivity: 1,
  haptics: true,
};

export const DEFAULT_PROGRESS: PlayerProgress = {
  bestHeight: 0,
  crystals: 0,
  skin: "blue",
  unlockedSkins: ["blue"],
};

const EMPTY_RUN: RunStats = { height: 0, crystals: 0, combo: 0 };

export const useGameStore = create<GameState>((set) => ({
  phase: "menu",
  settings: { ...DEFAULT_SETTINGS },
  progress: { ...DEFAULT_PROGRESS },
  run: { ...EMPTY_RUN },

  setPhase: (phase) => set({ phase }),

  updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

  setRun: (patch) => set((s) => ({ run: { ...s.run, ...patch } })),

  resetRun: () => set({ run: { ...EMPTY_RUN } }),

  addCrystals: (n) =>
    set((s) => ({
      run: { ...s.run, crystals: s.run.crystals + n },
      progress: { ...s.progress, crystals: s.progress.crystals + n },
    })),

  commitBestHeight: (height) =>
    set((s) => ({
      progress: {
        ...s.progress,
        bestHeight: Math.max(s.progress.bestHeight, Math.floor(height)),
      },
    })),

  setSkin: (skin) => set((s) => ({ progress: { ...s.progress, skin } })),

  unlockSkin: (skin) =>
    set((s) =>
      s.progress.unlockedSkins.includes(skin)
        ? s
        : {
            progress: {
              ...s.progress,
              unlockedSkins: [...s.progress.unlockedSkins, skin],
            },
          },
    ),
}));

/** Cost (in crystals) per skin — keep with the palette so shop + store agree. */
export const SKIN_COST: Record<BlobSkin, number> = {
  blue: 0,
  slime: 15,
  ghost: 30,
  ink: 50,
};

/** Convenience: the color for the currently equipped skin. */
export const equippedSkinColor = (s: GameState): string => palette.blob[s.progress.skin];
