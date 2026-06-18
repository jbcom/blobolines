import { z } from "zod";
import {
  setAmbientVolume,
  setMasterVolume,
  setMusicEnabled,
  setMusicVolume,
  setSfxVolume,
} from "@/audio";
import type { GameSettings, PlayerProgress } from "@/core/types";
import { loadJson, saveJson } from "@/platform";
import { DEFAULT_PROGRESS, DEFAULT_SETTINGS, type GameState, useGameStore } from "./store";

/**
 * Real persistence via Capacitor Preferences (native SharedPreferences on Android,
 * web impl on browser). Hydrate once at boot; subscribe to persist progress + settings
 * whenever they change. No localStorage branching, no "later".
 *
 * Hardened with Zod validation schemas during hydration to shield the application from
 * crash-loops caused by corrupted, modified, or malformed local preferences.
 */

const KEY_PROGRESS = "blobolines.progress";
const KEY_SETTINGS = "blobolines.settings";

const blobSkinSchema = z.enum(["blue", "slime", "ghost", "ink"]);

const playerProgressSchema = z.object({
  bestHeight: z.number().catch(0),
  bestScore: z.number().catch(0),
  crystals: z.number().catch(0),
  skin: blobSkinSchema.catch("blue"),
  unlockedSkins: z.array(blobSkinSchema).catch(["blue"]),
  tutorialSeen: z.boolean().catch(false),
  unlockedAchievements: z.array(z.string()).catch([]),
});

const persistedSettingsSchema = z.object({
  masterVolume: z.number().min(0).max(1).optional(),
  sfxVolume: z.number().min(0).max(1).optional(),
  musicVolume: z.number().min(0).max(1).optional(),
  ambientVolume: z.number().min(0).max(1).optional(),
  musicEnabled: z.boolean().optional(),
  chargeSensitivity: z.number().optional(),
  slingshotSensitivity: z.number().optional(),
  haptics: z.boolean().optional(),
  reducedMotion: z.boolean().optional(),
  qualityPref: z.enum(["auto", "low", "medium", "high"]).optional(),
});

function normalizeSettings(parsed: z.infer<typeof persistedSettingsSchema>): GameSettings {
  const legacyCharge = parsed.slingshotSensitivity;
  return {
    masterVolume: parsed.masterVolume ?? DEFAULT_SETTINGS.masterVolume,
    sfxVolume: parsed.sfxVolume ?? DEFAULT_SETTINGS.sfxVolume,
    musicVolume: parsed.musicVolume ?? DEFAULT_SETTINGS.musicVolume,
    ambientVolume: parsed.ambientVolume ?? DEFAULT_SETTINGS.ambientVolume,
    musicEnabled: parsed.musicEnabled ?? DEFAULT_SETTINGS.musicEnabled,
    chargeSensitivity:
      parsed.chargeSensitivity ?? legacyCharge ?? DEFAULT_SETTINGS.chargeSensitivity,
    haptics: parsed.haptics ?? DEFAULT_SETTINGS.haptics,
    reducedMotion: parsed.reducedMotion ?? DEFAULT_SETTINGS.reducedMotion,
    qualityPref: parsed.qualityPref ?? DEFAULT_SETTINGS.qualityPref,
  };
}

export async function hydrateStore(): Promise<void> {
  const [rawProgress, rawSettings] = await Promise.all([
    loadJson<unknown>(KEY_PROGRESS, null),
    loadJson<unknown>(KEY_SETTINGS, null),
  ]);

  let progress: PlayerProgress = DEFAULT_PROGRESS;
  if (rawProgress !== null) {
    const parsedProgress = playerProgressSchema.safeParse(rawProgress);
    if (parsedProgress.success) {
      progress = parsedProgress.data;
    } else {
      console.warn(
        "[blobolines] progress preference schema validation failed, falling back to default",
      );
    }
  }

  let settings: GameSettings = DEFAULT_SETTINGS;
  if (rawSettings !== null) {
    const parsedSettings = persistedSettingsSchema.safeParse(rawSettings);
    if (parsedSettings.success) {
      settings = normalizeSettings(parsedSettings.data);
    } else {
      console.warn(
        "[blobolines] settings preference schema validation failed, falling back to default",
      );
    }
  }

  useGameStore.setState({
    progress,
    settings,
  });

  // Push persisted audio settings to the engine so they take effect from boot, not only
  // when the user next touches a control.
  setMasterVolume(settings.masterVolume);
  setSfxVolume(settings.sfxVolume);
  setMusicVolume(settings.musicVolume);
  setAmbientVolume(settings.ambientVolume);
  setMusicEnabled(settings.musicEnabled);
}

/** Subscribe persistence to store changes. Returns an unsubscribe fn. */
export function attachPersistence(): () => void {
  let lastProgress = useGameStore.getState().progress;
  let lastSettings = useGameStore.getState().settings;

  const persist = (key: string, value: unknown) => {
    saveJson(key, value).catch((err) => {
      console.warn(`[blobolines] failed to persist ${key}:`, err);
    });
  };

  return useGameStore.subscribe((state: GameState) => {
    if (state.progress !== lastProgress) {
      lastProgress = state.progress;
      persist(KEY_PROGRESS, state.progress);
    }
    if (state.settings !== lastSettings) {
      lastSettings = state.settings;
      persist(KEY_SETTINGS, state.settings);
    }
  });
}
