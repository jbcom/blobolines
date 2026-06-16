import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import type { Color, Group, ShaderMaterial } from "three";
import type { BlobSkin, EyeExpression } from "@/core/types";
import { GooMaterial } from "@/render/materials";
import { combineScale, impactSquash, speedStretch } from "@/sim/blob";
import { getBlobDiagnostics } from "@/state";
import { palette } from "@/styles/tokens";
import { BlobEyes } from "./BlobEyes";

/**
 * The gooey blob actor — a goo-shaded sphere that squashes and stretches with motion +
 * impact, wearing the procedural expressive eyes. This component owns only the visual
 * deformation + material.
 *
 * Two modes:
 *  - `live`: read velocity/impact/expression from the diagnostics bridge each frame
 *    (the in-game blob, driven by Rapier) — NO per-frame React re-render.
 *  - props: static velocity/impact/expression (menu hero blob + fixture tests).
 */

interface BlobActorProps {
  skin?: BlobSkin;
  /** Current velocity (drives stretch). Ignored when `live`. */
  velocity?: readonly [number, number, number];
  /** Recent impact amount [0,1] (drives squash). Ignored when `live`. */
  impact?: number;
  /** Eye expression. Ignored when `live`. */
  expression?: EyeExpression;
  radius?: number;
  /** Read live state from the diagnostics bridge instead of props. */
  live?: boolean;
  /** Render the solid goo sphere body. Off when a GooField metaball skin replaces it
   *  (the eyes + squash group still apply). Default on (menu/fixtures). */
  body?: boolean;
}

export function BlobActor({
  skin = "blue",
  velocity = [0, 0, 0],
  impact = 0,
  expression = "idle",
  radius = 0.85,
  live = false,
  body = true,
}: BlobActorProps) {
  const groupRef = useRef<Group>(null);
  const material = useMemo(() => new GooMaterial() as unknown as ShaderMaterial, []);
  /** Surface-tension wobble envelope [0,1] — spikes on impact, decays each frame. */
  const wobble = useRef(0);

  // Release the compiled shader program when this blob unmounts (respawn, skin swap, HMR).
  useEffect(() => () => material.dispose(), [material]);

  // Keep material color in sync with the equipped skin (side effect → useEffect).
  useEffect(() => {
    (material.uniforms.uColor.value as Color).set(palette.blob[skin]);
    (material.uniforms.uRim.value as Color).set(palette.goo.rim);
  }, [material, skin]);

  useFrame((state, dt) => {
    material.uniforms.uTime.value = state.clock.elapsedTime;

    const g = groupRef.current;
    if (!g) return;

    const vel = live ? getBlobDiagnostics().velocity : velocity;
    const imp = live ? 1 - getBlobDiagnostics().squash : impact;

    const stretch = speedStretch(vel[0], vel[1], vel[2]);
    const squash = impactSquash(imp);
    const s = combineScale(stretch, squash);
    // Smooth toward the target deformation so it springs rather than snaps.
    const k = 1 - Math.exp(-dt / 0.06);
    g.scale.x += (s.x - g.scale.x) * k;
    g.scale.y += (s.y - g.scale.y) * k;
    g.scale.z += (s.z - g.scale.z) * k;

    // Surface-tension wobble: a fresh impact pumps the envelope up (toward the impact
    // amount), then it decays so the goo skin ripples and settles like a water balloon.
    wobble.current = Math.max(wobble.current * Math.exp(-dt / 0.5), imp);
    material.uniforms.uWobble.value = wobble.current;
  });

  return (
    <group ref={groupRef}>
      {body && (
        <mesh material={material}>
          <sphereGeometry args={[radius, 48, 48]} />
        </mesh>
      )}
      <BlobEyes expression={expression} radius={radius} live={live} />
    </group>
  );
}
