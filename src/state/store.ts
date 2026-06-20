import { create } from "zustand";
import { world as worldCfg } from "@/config";
import type {
  BlobSkin,
  GamePhase,
  GameSettings,
  HighScoreEntry,
  PlayerProgress,
} from "@/core/types";
import { ACHIEVEMENT_SKIN, type AchievementStats, newlyUnlocked } from "@/sim/achievements";
import { computeScore } from "@/sim/score";
import { palette } from "@/styles/tokens";
import { reportAchievementToast, resetAchievementToasts } from "./achievementToastBridge";
import { useWorldStore } from "./worldStore";

/**
 * The app/UI state bridge. The DOM overlay (shadcn) reads/writes here; the R3F scene
 * reads it too. Per-frame entity data lives in the physics simulation and diagnostics bridge, NOT here — this
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
  /** Composite score for this run (height + crystals + combo style). Set at run end. */
  score: number;
  /** Per-bounce points from landing near certified golden-path targets. */
  stylePoints: number;
  /** Points this run beat the PREVIOUS best SCORE by (0 if not a score record). */
  scoreDelta: number;
  /** Achievements unlocked during this run. */
  unlockedAchievements: string[];
}

export interface GameState {
  phase: GamePhase;
  settings: GameSettings;
  progress: PlayerProgress;
  run: RunStats;
  /** Transient (not persisted): set true to request the menu open the blob customizer on
   *  arrival — e.g. tapping "Customize" from the game-over card. TitleScreen consumes it. */
  customizerIntent: boolean;
  /** Transient: is the CURRENT run a daily challenge (seeded from today's date)? Drives the
   *  game-over card to show the shareable daily run hash. Cleared when a normal run starts. */
  dailyRun: boolean;

  setPhase: (phase: GamePhase) => void;
  setCustomizerIntent: (open: boolean) => void;
  setDailyRun: (daily: boolean) => void;
  updateSettings: (patch: Partial<GameSettings>) => void;
  setRun: (patch: Partial<RunStats>) => void;
  resetRun: () => void;
  addCrystals: (n: number) => void;
  commitBestHeight: (height: number) => void;
  markTutorialSeen: () => void;
  /** Evaluate achievements against the given stats snapshot, persist any newly-unlocked, and
   *  return the freshly-unlocked ids (for the unlock toast). */
  unlockAchievements: (stats: AchievementStats) => string[];
  setSkin: (skin: BlobSkin) => void;
  unlockSkin: (skin: BlobSkin) => void;
  /** Wipe all progress (best height, crystals, unlocks, skin) back to defaults. */
  resetProgress: () => void;
}

export const DEFAULT_SETTINGS: GameSettings = {
  masterVolume: 0.8,
  sfxVolume: 0.9,
  musicVolume: 0.8,
  ambientVolume: 0.7,
  musicEnabled: true,
  chargeSensitivity: 1,
  haptics: true,
  reducedMotion: false,
  qualityPref: "auto",
};

export const DEFAULT_PROGRESS: PlayerProgress = {
  bestHeight: 0,
  bestScore: 0,
  crystals: 0,
  skin: "blue",
  unlockedSkins: ["blue"],
  tutorialSeen: false,
  unlockedAchievements: [],
  highScores: [],
};

const EMPTY_RUN: RunStats = {
  height: 0,
  crystals: 0,
  combo: 0,
  maxCombo: 0,
  recordDelta: 0,
  score: 0,
  stylePoints: 0,
  scoreDelta: 0,
  unlockedAchievements: [],
};

/**
 * Pure helper function to check and unlock achievements in real-time.
 */
function checkAndUnlock(
  progress: PlayerProgress,
  run: RunStats,
): { progress: PlayerProgress; run: RunStats; fresh: string[] } {
  const stats: AchievementStats = {
    bestHeight: Math.max(progress.bestHeight, Math.floor(run.height)),
    bestScore: progress.bestScore,
    lifetimeCrystals: progress.crystals,
    runHeight: Math.floor(run.height),
    runMaxCombo: run.maxCombo,
    runCrystals: run.crystals,
  };

  const fresh = newlyUnlocked(stats, progress.unlockedAchievements);
  if (fresh.length === 0) {
    return { progress, run, fresh };
  }

  // Grant any skin EARNED by a freshly-unlocked achievement (a milestone cosmetic reward) — the
  // achievement is the only way to get these skins (they aren't crystal-buyable).
  const earnedSkins = fresh
    .map((id) => ACHIEVEMENT_SKIN[id])
    .filter((skin): skin is BlobSkin => Boolean(skin) && !progress.unlockedSkins.includes(skin));

  return {
    progress: {
      ...progress,
      unlockedAchievements: [...progress.unlockedAchievements, ...fresh],
      unlockedSkins:
        earnedSkins.length > 0
          ? [...progress.unlockedSkins, ...earnedSkins]
          : progress.unlockedSkins,
    },
    run: {
      ...run,
      unlockedAchievements: [...(run.unlockedAchievements || []), ...fresh],
    },
    fresh,
  };
}

export const useGameStore = create<GameState>((set) => ({
  phase: "menu",
  settings: { ...DEFAULT_SETTINGS },
  progress: { ...DEFAULT_PROGRESS },
  run: { ...EMPTY_RUN },
  customizerIntent: false,
  dailyRun: false,

  setPhase: (phase) => set({ phase }),
  setCustomizerIntent: (open) => set({ customizerIntent: open }),
  setDailyRun: (daily) => set({ dailyRun: daily }),

  updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

  setRun: (patch) => {
    // The set() updater stays pure (no side effects); collect freshly-unlocked ids and fire
    // the toast side effect afterwards so the Zustand mutator isn't doing I/O mid-mutation.
    let unlocked: string[] = [];
    set((s) => {
      const nextRun = { ...s.run, ...patch };
      const { progress, run, fresh } = checkAndUnlock(s.progress, nextRun);
      unlocked = fresh;
      return { progress, run };
    });
    for (const id of unlocked) {
      reportAchievementToast(id);
    }
  },

  resetRun: () => {
    resetAchievementToasts(); // drop any queued toasts so they don't fire on the next run
    set({ run: { ...EMPTY_RUN } });
  },

  markTutorialSeen: () =>
    set((s) => (s.progress.tutorialSeen ? s : { progress: { ...s.progress, tutorialSeen: true } })),

  unlockAchievements: (stats) => {
    const fresh = newlyUnlocked(stats, useGameStore.getState().progress.unlockedAchievements);
    if (fresh.length > 0) {
      set((s) => {
        // Grant any skin earned by a freshly-unlocked achievement (same milestone-reward path as
        // checkAndUnlock — keep both achievement-evaluation paths consistent).
        const earnedSkins = fresh
          .map((id) => ACHIEVEMENT_SKIN[id])
          .filter(
            (skin): skin is BlobSkin => Boolean(skin) && !s.progress.unlockedSkins.includes(skin),
          );
        return {
          progress: {
            ...s.progress,
            unlockedAchievements: [...s.progress.unlockedAchievements, ...fresh],
            unlockedSkins:
              earnedSkins.length > 0
                ? [...s.progress.unlockedSkins, ...earnedSkins]
                : s.progress.unlockedSkins,
          },
          run: {
            ...s.run,
            unlockedAchievements: [...(s.run.unlockedAchievements || []), ...fresh],
          },
        };
      });
      // Toast each newly unlocked achievement!
      for (const id of fresh) {
        reportAchievementToast(id);
      }
    }
    return fresh;
  },

  addCrystals: (n) =>
    set((s) => {
      const nextRun = { ...s.run, crystals: s.run.crystals + n };
      const nextProgress = { ...s.progress, crystals: s.progress.crystals + n };
      const { progress, run } = checkAndUnlock(nextProgress, nextRun);
      return { progress, run };
    }),

  commitBestHeight: (height) =>
    set((s) => {
      const h = Math.floor(height);
      // Metres over the PREVIOUS best (before this commit overwrites it) — 0 if not a record.
      const recordDelta = Math.max(0, h - s.progress.bestHeight);
      // Composite run score from the final height + this run's crystals + best combo, vs the
      // PREVIOUS best score. Score is a SEPARATE record from height: a shorter, crystal/combo-
      // rich run can beat the score best without beating the height best.
      const runScore = computeScore({
        height: h,
        crystals: s.run.crystals,
        maxCombo: s.run.maxCombo,
        stylePoints: s.run.stylePoints,
      });
      const scoreDelta = Math.max(0, runScore - s.progress.bestScore);

      const worldState = useWorldStore.getState();
      const newEntry: HighScoreEntry = {
        score: runScore,
        height: h,
        crystals: s.run.crystals,
        maxCombo: s.run.maxCombo,
        date: new Date().toISOString(),
        seedPhrase: worldState.seedPhrase,
        difficulty: worldState.difficulty,
      };

      const updatedScores = [...(s.progress.highScores || []), newEntry]
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);

      const nextRun: RunStats = {
        ...s.run,
        recordDelta,
        score: runScore,
        scoreDelta,
      };
      const nextProgress: PlayerProgress = {
        ...s.progress,
        bestHeight: Math.max(s.progress.bestHeight, h),
        bestScore: Math.max(s.progress.bestScore, runScore),
        highScores: updatedScores,
      };

      const { progress, run } = checkAndUnlock(nextProgress, nextRun);
      return { progress, run };
    }),

  resetProgress: () => set({ progress: { ...DEFAULT_PROGRESS } }),

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
