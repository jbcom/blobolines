/**
 * Device-aware UI scaling. Sizes the HUD/menus/readouts to the actual device instead of one
 * fixed px scale, on web AND in the Capacitor webview. The signal is viewport min-dimension +
 * pointer type (touch vs fine) — available identically everywhere, no native dep needed.
 *
 * The pure `deviceScale()` returns a class + a numeric UI scale; `applyDeviceScale()` writes
 * it to the `--ui-scale` CSS var on :root and (re)binds to viewport changes.
 */

export type DeviceClass = "phone" | "tablet" | "desktop";

export interface DeviceScale {
  deviceClass: DeviceClass;
  /** Multiplier applied to UI sizing (1 = baseline tablet/desktop). */
  scale: number;
}

export interface ViewportInfo {
  /** Smaller of the two CSS-pixel viewport dimensions. */
  minDim: number;
  /** Coarse pointer (touch) vs fine (mouse). */
  coarsePointer: boolean;
}

/**
 * Pure: classify the device + pick a UI scale from viewport min-dimension + pointer type.
 * Phones (narrow, touch) get a slightly LARGER UI so tap targets/readouts stay legible at
 * arm's length; tablets baseline; desktop (fine pointer, wide) baseline with a tiny bump on
 * very large screens so the HUD doesn't look lost.
 */
export function deviceScale({ minDim, coarsePointer }: ViewportInfo): DeviceScale {
  if (coarsePointer && minDim < 600) {
    // Phone: scale up a touch on the smallest screens so controls stay thumb-sized.
    const s = minDim < 380 ? 1.18 : 1.1;
    return { deviceClass: "phone", scale: s };
  }
  if (coarsePointer && minDim < 1024) {
    return { deviceClass: "tablet", scale: 1 };
  }
  // Desktop / large: baseline, with a gentle bump past ~1600px min-dim.
  return { deviceClass: "desktop", scale: minDim > 1600 ? 1.1 : 1 };
}

/** Read the live viewport (DOM). Guarded for non-browser (SSR/test) → tablet defaults. */
function readViewport(): ViewportInfo {
  if (typeof window === "undefined") return { minDim: 800, coarsePointer: false };
  return {
    minDim: Math.min(window.innerWidth, window.innerHeight),
    coarsePointer:
      typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches,
  };
}

/**
 * Compute the device scale and write it to `--ui-scale` on :root, rebinding on resize/
 * orientation change. Returns an unsubscribe fn + the current scale. No-op safely off-DOM.
 */
export function applyDeviceScale(): { current: () => DeviceScale; detach: () => void } {
  let cur = deviceScale(readViewport());
  const write = () => {
    cur = deviceScale(readViewport());
    if (typeof document !== "undefined") {
      document.documentElement.style.setProperty("--ui-scale", String(cur.scale));
      document.documentElement.dataset.device = cur.deviceClass;
    }
  };
  write();
  if (typeof window !== "undefined") window.addEventListener("resize", write);
  return {
    current: () => cur,
    detach: () => {
      if (typeof window !== "undefined") window.removeEventListener("resize", write);
    },
  };
}
