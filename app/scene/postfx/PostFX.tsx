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
import { useRef } from "react";
import { Vector2 } from "three";
import { getBlobDiagnostics } from "@/state";

/**
 * Post-processing stack — soft gooey glow, not neon. Bloom for the wet highlights, a
 * gentle color grade, a vignette for depth, and a subtle chromatic aberration that
 * pulses with the blob's speed (juicy on big launches). Mobile-conscious: multisampling
 * off, modest bloom. Stack adapted from arcade-cabinet (midway-mayhem PostFX).
 */
export function PostFX() {
  const chroma = useRef(new Vector2(0.0006, 0.0006));

  useFrame(() => {
    // Mutate the Vector2 in place (never reassign — avoids a circular-ref crash in the
    // effect's uniform diffing). Scale with vertical speed.
    const speed = Math.abs(getBlobDiagnostics().velocity[1]);
    const k = 0.0006 + Math.min(speed / 40, 1) * 0.0024;
    chroma.current.set(k, k);
  });

  return (
    <EffectComposer multisampling={0}>
      <Bloom intensity={0.28} luminanceThreshold={0.85} luminanceSmoothing={0.3} mipmapBlur />
      <HueSaturation saturation={0.08} />
      <BrightnessContrast brightness={0.02} contrast={0.06} />
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
