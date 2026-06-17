import { useFrame } from "@react-three/fiber";
import {
  Bloom,
  BrightnessContrast,
  ChromaticAberration,
  DepthOfField,
  EffectComposer,
  HueSaturation,
  Vignette,
} from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";
import { type ReactElement, useRef, useState } from "react";
import { Vector2 } from "three";
import { getQuality } from "@/render/qualityBridge";
import { getBlobDiagnostics } from "@/state";
import { N8AO } from "./N8AO";

/** Altitude (world Y) by which the grade reaches its full "space" mood. */
const SPACE_AT = 700;
/** Discrete grade steps so the altitude grade re-renders the composer only a handful of times
 *  over a whole climb (not per frame) — passing live per-frame numbers as effect PROPS crashes
 *  @react-three/postprocessing's reconciler (circular-structure serialize). */
const GRADE_STEPS = 6;

/**
 * Post-processing stack — soft gooey glow, not neon. Bloom for the wet highlights, a
 * gentle color grade, a vignette for depth, and a subtle chromatic aberration that
 * pulses with the blob's speed (juicy on big launches). Mobile-conscious: multisampling
 * off, modest bloom. Stack adapted from arcade-cabinet (midway-mayhem PostFX).
 *
 * Per-biome grade: bloom/saturation/contrast climb with altitude (warm+soft ground →
 * brighter-glow+cooler+crisper space). Stepped into GRADE_STEPS bands held in state so the
 * composer re-renders only on a band change — the ChromaticAberration offset is the only
 * per-frame value, driven by mutating its Vector2 prop in place (never as a re-render).
 */
export function PostFX({ playing }: { playing: boolean }) {
  const chroma = useRef(new Vector2(0.0006, 0.0006));
  const [grade, setGrade] = useState(0); // 0..1, quantized to GRADE_STEPS
  // Quality gate (resolved at boot from the device tier): AO is medium+ only, bloom scales by
  // tier so low-end devices skip/soften the heavy passes. Read once on mount (tier is stable
  // per session unless an FPS monitor downgrades it; PostFX remounts are rare).
  const quality = getQuality();

  useFrame(() => {
    const diag = getBlobDiagnostics();
    // Mutate the Vector2 in place (never reassign — avoids a circular-ref crash in the
    // effect's uniform diffing). Scale with vertical speed.
    const speed = Math.abs(diag.velocity[1]);
    const k = 0.0006 + Math.min(speed / 40, 1) * 0.0024;
    chroma.current.set(k, k);

    // Quantize altitude → a grade band; only commit to state (re-render) on a band change.
    const sky = Math.min(1, Math.max(0, diag.position[1] / SPACE_AT));
    const stepped = Math.round(sky * GRADE_STEPS) / GRADE_STEPS;
    if (stepped !== grade) setGrade(stepped);
  });

  // Build the effect list as an array, filtering out the tier-gated passes, so the composer
  // never receives a `false`/`undefined` child (postprocessing's composer rejects non-effect
  // children). AO is the medium+ pass the low tier drops entirely.
  const effects = [
    // AO first (right after the render pass) so creases are darkened before bloom/grade —
    // grounds the goo where it meets pads and where droplets fuse into the body.
    quality.ao ? <N8AO key="ao" /> : null,
    // Bloom strength scales by tier (low devices get a softer, cheaper bloom) + lifts with the
    // altitude grade band (warm+soft ground → brighter+cooler+crisper space). Threshold raised
    // to 1.0 so ONLY the HDR (>1) pixels bloom — i.e. the emissive/toneMapped-off elements
    // (crystal twinkle spikes, flame-tinted goo, additive powerup auras + rings) — not merely
    // bright diffuse surfaces like the lit sky. An emissive-channel-selective glow without the
    // fragile SelectiveBloom Selection wiring (which fought the EffectComposer reconciler).
    <Bloom
      key="bloom"
      intensity={(0.4 + grade * 0.5) * quality.bloom}
      luminanceThreshold={1.0}
      luminanceSmoothing={0.2}
      mipmapBlur
    />,
    <HueSaturation key="hue" saturation={0.08 + grade * 0.12} />,
    <BrightnessContrast key="bc" brightness={0.02} contrast={0.06 + grade * 0.14} />,
    <ChromaticAberration
      key="ca"
      blendFunction={BlendFunction.NORMAL}
      offset={chroma.current}
      radialModulation={false}
      modulationOffset={0}
    />,
    <Vignette key="vig" eskil={false} offset={0.25} darkness={0.45} />,
    // Depth-of-field — HIGH-tier AND in-game only (NOT the menu, where the blob is the hero and
    // must stay sharp). Focus sits at the blob's mid-distance with a long focal range so only
    // the FAR tower/backdrop softens behind a sharp blob — gentle bokeh, mobile-reasonable.
    quality.dof && playing ? (
      <DepthOfField key="dof" focusDistance={0.04} focalLength={0.5} bokehScale={1.4} />
    ) : null,
  ].filter((e): e is ReactElement => e !== null);

  return <EffectComposer multisampling={0}>{effects}</EffectComposer>;
}
