import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";

/**
 * Haptic feedback via Capacitor Haptics. On web the plugin no-ops (or uses the
 * Vibration API where available), so callers never branch on platform. Every call is
 * gated by the caller's settings.haptics; failures are swallowed (haptics are juice,
 * never load-bearing).
 */

export async function impact(style: ImpactStyle = ImpactStyle.Medium): Promise<void> {
  try {
    await Haptics.impact({ style });
  } catch {
    // no-op where unsupported
  }
}

export async function notify(type: NotificationType = NotificationType.Success): Promise<void> {
  try {
    await Haptics.notification({ type });
  } catch {
    // no-op
  }
}

export async function vibrate(durationMs = 30): Promise<void> {
  try {
    await Haptics.vibrate({ duration: durationMs });
  } catch {
    // no-op
  }
}

export { ImpactStyle, NotificationType };
