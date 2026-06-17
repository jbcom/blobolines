import { useFrame } from "@react-three/fiber";
import {
  Bloom,
  BrightnessContrast,
  ChromaticAberration,
  EffectComposer,
  HueSaturation,
  Vignette,
} from "@react-three/postprocessing";
import type { BloomEffect, BrightnessContrastEffect, HueSaturationEffect } from "postprocessing";
import { BlendFunction } from "postprocessing";
import { useRef } from "react";
import { Vector2 } from "three";
import { getBlobDiagnostics } from "@/state";
import { N8AO } from "./N8AO";

/** Smooth 0→1 ramp over the altitude where the world transitions ground → space. */
const SPACE_AT = 700; // ~the stratosphere/space band

/**
 * Post-processing stack — soft gooey glow, not neon. Bloom for the wet highlights, a
 * gentle color grade, a vignette for depth, and a subtle chromatic aberration that
 * pulses with the blob's speed (juicy on big launches). Mobile-conscious: multisampling
 * off, modest bloom. Stack adapted from arcade-cabinet (midway-mayhem PostFX).
 */
export function PostFX() {
  const chroma = useRef(new Vector2(0.0006, 0.0006));
  const bloom = useRef<BloomEffect>(null);
  const hueSat = useRef<HueSaturationEffect>(null);
  const briCon = useRef<BrightnessContrastEffect>(null);

  useFrame(() => {
    const diag = getBlobDiagnostics();
    // Mutate the Vector2 in place (never reassign — avoids a circular-ref crash in the
    // effect's uniform diffing). Scale with vertical speed.
    const speed = Math.abs(diag.velocity[1]);
    const k = 0.0006 + Math.min(speed / 40, 1) * 0.0024;
    chroma.current.set(k, k);

    // Per-biome color GRADE by altitude: warm + soft at the ground, cold + high-contrast +
    // brighter bloom up in space, so the climb's mood shifts with the sky. Drives the effect
    // uniforms imperatively (no React churn).
    const sky = Math.min(1, Math.max(0, diag.position[1] / SPACE_AT));
    if (bloom.current) bloom.current.intensity = 0.28 + sky * 0.5; // more glow on the highlights up high
    if (hueSat.current) hueSat.current.saturation = 0.08 + sky * 0.12; // richer/cooler high
    if (briCon.current) briCon.current.contrast = 0.06 + sky * 0.14; // crisper, moodier high
  });

  return (
    <EffectComposer multisampling={0}>
      {/* AO first (right after the render pass) so creases are darkened before bloom/grade —
          grounds the goo where it meets pads and where droplets fuse into the body. */}
      <N8AO />
      <Bloom
        ref={bloom}
        intensity={0.28}
        luminanceThreshold={0.85}
        luminanceSmoothing={0.3}
        mipmapBlur
      />
      <HueSaturation ref={hueSat} saturation={0.08} />
      <BrightnessContrast ref={briCon} brightness={0.02} contrast={0.06} />
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
