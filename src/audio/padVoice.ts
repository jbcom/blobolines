import type { TrampType } from "@/core/types";

/**
 * Per-pad-type bounce VOICE (pure): which sample to play and how to pitch/level it, so every
 * pad sounds distinct from the owned sample set without sourcing a separate file per type.
 * Most pads share the punchy `bounce` sample but are re-pitched + re-leveled into a character:
 * booster springs up bright, super lands heavy + loud, moving has a metallic detune, wobbler
 * an unstable wobble-down. Ice/fragile keep their own dedicated samples. Impact strength
 * brightens the pitch a touch (a harder hit reads sharper), so bounces aren't monotonous.
 */

export type BounceSampleId = "bounce" | "bounce_soft" | "bounce_ice";

export interface PadVoice {
  sample: BounceSampleId;
  /** Playback rate (pitch). 1 = native. */
  rate: number;
  /** Volume multiplier on top of the SFX channel. */
  volume: number;
}

/** Base voice per pad type (before impact-strength brightening). */
const BASE: Record<TrampType, PadVoice> = {
  standard: { sample: "bounce", rate: 1.0, volume: 1.0 },
  // Booster: springy + bright — pitched up, a touch louder.
  booster: { sample: "bounce", rate: 1.22, volume: 1.05 },
  // Super: heavy mega-launch — pitched down + loud so it lands with weight.
  super: { sample: "bounce", rate: 0.72, volume: 1.25 },
  // Moving/slider: metallic rail catch — slightly detuned up.
  moving: { sample: "bounce", rate: 1.1, volume: 0.95 },
  // Canted: angled launch — a hair brighter than standard so the redirect reads.
  canted: { sample: "bounce", rate: 1.06, volume: 1.0 },
  // Wobbler: unstable — pitched down + quieter, the "off-balance" voice.
  wobbler: { sample: "bounce", rate: 0.9, volume: 0.92 },
  // Fragile: soft wood (its own gentle sample).
  fragile: { sample: "bounce_soft", rate: 1.0, volume: 0.9 },
  // Ice: glassy bright click (its own sample).
  ice: { sample: "bounce_ice", rate: 1.0, volume: 1.0 },
};

/**
 * Resolve the bounce voice for a pad type at an impact `strength` in [0,1]. Strength nudges
 * the pitch up to ~+12% (harder hits sound sharper) and the volume up to ~+20%, clamped so a
 * gentle settle stays soft. Pure + deterministic.
 */
export function padVoice(type: TrampType, strength = 1): PadVoice {
  const base = BASE[type] ?? BASE.standard;
  const s = Math.max(0, Math.min(1, strength));
  return {
    sample: base.sample,
    rate: base.rate * (0.94 + 0.18 * s),
    volume: base.volume * (0.8 + 0.4 * s),
  };
}
