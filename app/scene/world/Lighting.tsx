import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type * as THREE from "three";
import { biomeSkyAt } from "@/config";
import { getBlobDiagnostics } from "@/state";
import { hex, palette } from "@/styles/tokens";

/**
 * Scene lighting for the dreamy painterly look from the cover art: warm honey key light,
 * blue daylight sky bounce, and a soft cream rim — at the LOWER bands. The whole rig is
 * height-reactive: as the blob climbs into the thin-air / space bands, the lights cool toward
 * the band's own colors and DIM, so the upper bands read as cold and airless instead of being
 * flooded warm-cream by a static daylight rig (which left the space band's center a muddy tan
 * even though its sky/fog were near-black). Real final lighting — not a placeholder.
 */

/** Altitude (world Y) by which the lighting has fully reached its dim cold-space state. */
const SPACE_LIGHT_Y = 950;

export function Lighting() {
  const ambientRef = useRef<THREE.AmbientLight>(null);
  const hemiRef = useRef<THREE.HemisphereLight>(null);
  const keyRef = useRef<THREE.DirectionalLight>(null);
  const fillRef = useRef<THREE.DirectionalLight>(null);

  useFrame(() => {
    const height = getBlobDiagnostics().position[1];
    const b = biomeSkyAt(height);
    // 0 at ground → 1 in space. The upper bands lose the warm daylight rig as the air thins.
    const t = Math.min(1, Math.max(0, height / SPACE_LIGHT_Y));

    // Ambient + hemisphere bounce: tint toward the band's TOP/MID/DEEP and drop intensity, so the
    // foreground picks up the band's color instead of a fixed cream — and the space band goes dim.
    const ambient = ambientRef.current;
    if (ambient) {
      ambient.color.set(hex(b.top));
      ambient.intensity = 0.9 - 0.55 * t;
    }
    const hemi = hemiRef.current;
    if (hemi) {
      hemi.color.set(hex(b.mid));
      hemi.groundColor.set(hex(b.deep));
      hemi.intensity = 1.1 - 0.7 * t;
    }
    // Key light: the warm sun. It cools toward the band MID and fades to a low fill as the visible
    // sun sprite fades out around space — no daylight key in the airless dark.
    const key = keyRef.current;
    if (key) {
      key.color.set(hex(b.mid));
      key.intensity = 2.25 - 1.7 * t;
    }
    // Cold rim fill stays roughly constant but cools with the band so silhouettes still read.
    const fill = fillRef.current;
    if (fill) {
      fill.color.set(hex(b.deep));
      fill.intensity = 0.6 - 0.25 * t;
    }
  });

  return (
    <>
      <ambientLight ref={ambientRef} intensity={0.9} color={palette.sky.top} />
      <hemisphereLight
        ref={hemiRef}
        intensity={1.1}
        color={palette.sky.top}
        groundColor={palette.sky.deep}
      />
      <directionalLight
        ref={keyRef}
        position={[6, 14, 8]}
        intensity={2.25}
        color={palette.sun}
        castShadow
      />
      <directionalLight
        ref={fillRef}
        position={[-8, 6, -6]}
        intensity={0.6}
        color={palette.sky.mid}
      />
    </>
  );
}
