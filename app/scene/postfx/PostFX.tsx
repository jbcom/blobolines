import { useFrame } from "@react-three/fiber";
import {
  Bloom,
  BrightnessContrast,
  ChromaticAberration,
  EffectComposer,
  HueSaturation,
  Vignette,
} from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";
import { useRef, useState } from "react";
import { Vector2 } from "three";
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
export function PostFX() {
  const chroma = useRef(new Vector2(0.0006, 0.0006));
  const [grade, setGrade] = useState(0); // 0..1, quantized to GRADE_STEPS

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

  return (
    <EffectComposer multisampling={0}>
      {/* AO first (right after the render pass) so creases are darkened before bloom/grade —
          grounds the goo where it meets pads and where droplets fuse into the body. */}
      <N8AO />
      {/* Bloom/saturation/contrast lift with the altitude grade band (warm+soft ground →
          brighter+cooler+crisper space). Props change only on a band crossing. */}
      <Bloom
        intensity={0.28 + grade * 0.5}
        luminanceThreshold={0.85}
        luminanceSmoothing={0.3}
        mipmapBlur
      />
      <HueSaturation saturation={0.08 + grade * 0.12} />
      <BrightnessContrast brightness={0.02} contrast={0.06 + grade * 0.14} />
      <ChromaticAberration
        blendFunction={BlendFunction.NORMAL}
        offset={chroma.current}
        radialModulation={false}
        modulationOffset={0}
      />
      <Vignette eskil={false} offset={0.25} darkness={0.45} />
    </EffectComposer>
  );
}
