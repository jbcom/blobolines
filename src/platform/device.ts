import { ScreenOrientation } from "@capacitor/screen-orientation";
import { KeepAwake } from "@capacitor-community/keep-awake";

/**
 * Device controls — orientation lock (Blobolines is a vertical climber, so portrait)
 * and keep-awake (don't dim the screen mid-run). All no-op safely on web.
 */

export async function lockPortrait(): Promise<void> {
  try {
    await ScreenOrientation.lock({ orientation: "portrait" });
  } catch {
    // unsupported on web
  }
}

export async function unlockOrientation(): Promise<void> {
  try {
    await ScreenOrientation.unlock();
  } catch {
    // no-op
  }
}

export async function keepAwake(): Promise<void> {
  try {
    await KeepAwake.keepAwake();
  } catch {
    // no-op
  }
}

export async function allowSleep(): Promise<void> {
  try {
    await KeepAwake.allowSleep();
  } catch {
    // no-op
  }
}
