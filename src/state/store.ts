import { create } from "zustand";
import { world as worldCfg } from "@/config";
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
  /** Highest combo reached this run (for the game-over recap). */
  maxCombo: number;
  /** Metres this run beat the PREVIOUS all-time best by (0 if not a record). Set by
   *  commitBestHeight at run end so the game-over card can show "+N m over best". */
  recordDelta: number;
}

export interface GameState {
  phase: GamePhase;
  settings: GameSettings;
  progress: PlayerProgress;
  run: RunStats;
  /** Transient (not persisted): set true to request the menu open the blob customizer on
   *  arrival — e.g. tapping "Customize" from the game-over card. TitleScreen consumes it. */
  customizerIntent: boolean;

  setPhase: (phase: GamePhase) => void;
  setCustomizerIntent: (open: boolean) => void;
  updateSettings: (patch: Partial<GameSettings>) => void;
  setRun: (patch: Partial<RunStats>) => void;
  resetRun: () => void;
  addCrystals: (n: number) => void;
  commitBestHeight: (height: number) => void;
  markTutorialSeen: () => void;
  setSkin: (skin: BlobSkin) => void;
  unlockSkin: (skin: BlobSkin) => void;
}

export const DEFAULT_SETTINGS: GameSettings = {
  masterVolume: 0.8,
  sfxVolume: 0.9,
  musicEnabled: true,
  slingshotSensitivity: 1,
  haptics: true,
  reducedMotion: false,
};

export const DEFAULT_PROGRESS: PlayerProgress = {
  bestHeight: 0,
  crystals: 0,
  skin: "blue",
  unlockedSkins: ["blue"],
  tutorialSeen: false,
};

const EMPTY_RUN: RunStats = { height: 0, crystals: 0, combo: 0, maxCombo: 0, recordDelta: 0 };

export const useGameStore = create<GameState>((set) => ({
  phase: "menu",
  settings: { ...DEFAULT_SETTINGS },
  progress: { ...DEFAULT_PROGRESS },
  run: { ...EMPTY_RUN },
  customizerIntent: false,

  setPhase: (phase) => set({ phase }),
  setCustomizerIntent: (open) => set({ customizerIntent: open }),

  updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

  setRun: (patch) => set((s) => ({ run: { ...s.run, ...patch } })),

  resetRun: () => set({ run: { ...EMPTY_RUN } }),

  markTutorialSeen: () =>
    set((s) => (s.progress.tutorialSeen ? s : { progress: { ...s.progress, tutorialSeen: true } })),

  addCrystals: (n) =>
    set((s) => ({
      run: { ...s.run, crystals: s.run.crystals + n },
      progress: { ...s.progress, crystals: s.progress.crystals + n },
    })),

  commitBestHeight: (height) =>
    set((s) => {
      const h = Math.floor(height);
      // Metres over the PREVIOUS best (before this commit overwrites it) — 0 if not a record.
      const recordDelta = Math.max(0, h - s.progress.bestHeight);
      return {
        run: { ...s.run, recordDelta },
        progress: { ...s.progress, bestHeight: Math.max(s.progress.bestHeight, h) },
      };
    }),

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

/** Cost (in crystals) per skin — data-driven from src/config/world.json. */
export const SKIN_COST: Record<BlobSkin, number> = worldCfg.skinCost;

/** Convenience: the color for the currently equipped skin. */
export const equippedSkinColor = (s: GameState): string => palette.blob[s.progress.skin];
