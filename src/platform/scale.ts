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
 *
 * CRITICAL: on a PHONE the HUD must never grow into the (already tiny) play area. A small touch
 * screen is where screen real estate is scarcest — scaling the readouts UP there is exactly
 * backwards (it made "all the info rectangles cover the screen" on small phones). So phones scale
 * DOWN a touch on the smallest screens and sit at baseline otherwise; thumb-sized tap targets come
 * from per-component min sizes, NOT a global upscale. Tablets baseline; desktop baseline with a
 * gentle bump on very large screens so the HUD doesn't look lost.
 */
export function deviceScale({ minDim, coarsePointer }: ViewportInfo): DeviceScale {
  if (coarsePointer && minDim < 600) {
    // Phone: the smallest screens scale the HUD slightly DOWN so the readouts keep clear of the
    // play area; mid phones stay at baseline. Never above 1 — the play area comes first.
    const s = minDim < 380 ? 0.92 : 1;
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
