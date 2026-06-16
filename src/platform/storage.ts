import { Preferences } from "@capacitor/preferences";

/**
 * Persistent key/value storage via Capacitor Preferences. This is the real
 * cross-platform store: on Android it uses native SharedPreferences, on web it uses
 * the Capacitor Preferences web implementation. One API, no per-platform branching.
 */

export async function loadJson<T>(key: string, fallback: T): Promise<T> {
  const { value } = await Preferences.get({ key });
  if (value == null) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export async function saveJson(key: string, value: unknown): Promise<void> {
  await Preferences.set({ key, value: JSON.stringify(value) });
}

export async function removeKey(key: string): Promise<void> {
  await Preferences.remove({ key });
}
