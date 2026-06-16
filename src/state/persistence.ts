import { setMasterVolume, setMusicEnabled, setSfxVolume } from "@/audio";
import type { GameSettings, PlayerProgress } from "@/core/types";
import { loadJson, saveJson } from "@/platform";
import { DEFAULT_PROGRESS, DEFAULT_SETTINGS, type GameState, useGameStore } from "./store";

/**
 * Real persistence via Capacitor Preferences (native SharedPreferences on Android,
 * web impl on browser). Hydrate once at boot; subscribe to persist progress + settings
 * whenever they change. No localStorage branching, no "later".
 */

const KEY_PROGRESS = "blobolines.progress";
const KEY_SETTINGS = "blobolines.settings";

export async function hydrateStore(): Promise<void> {
  const [progress, settings] = await Promise.all([
    loadJson<PlayerProgress>(KEY_PROGRESS, DEFAULT_PROGRESS),
    loadJson<GameSettings>(KEY_SETTINGS, DEFAULT_SETTINGS),
  ]);
  const mergedSettings = { ...DEFAULT_SETTINGS, ...settings };
  useGameStore.setState({
    progress: { ...DEFAULT_PROGRESS, ...progress },
    settings: mergedSettings,
  });
  // Push persisted audio settings to the engine so they take effect from boot, not only
  // when the user next touches a control.
  setMasterVolume(mergedSettings.masterVolume);
  setSfxVolume(mergedSettings.sfxVolume);
  setMusicEnabled(mergedSettings.musicEnabled);
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
