import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import type { Color, Group, ShaderMaterial } from "three";
import type { BlobSkin, EyeExpression } from "@/core/types";
import { GooMaterial } from "@/render/materials";
import { combineScale, impactSquash, speedStretch } from "@/sim/blob";
import { palette } from "@/styles/tokens";
import { BlobEyes } from "./BlobEyes";

/**
 * The gooey blob actor — a goo-shaded sphere that squashes and stretches with motion +
 * impact, wearing the procedural expressive eyes. Velocity/impact/expression are passed
 * in (driven by the sim); this component owns only the visual deformation + material.
 */

interface BlobActorProps {
  skin?: BlobSkin;
  /** Current velocity (drives stretch). */
  velocity?: readonly [number, number, number];
  /** Recent impact amount [0,1] (drives squash). */
  impact?: number;
  expression?: EyeExpression;
  radius?: number;
}

// drei shaderMaterial registers a lowercase JSX tag, but constructing directly keeps
// types simple and lets us drive uniforms imperatively.
export function BlobActor({
  skin = "blue",
  velocity = [0, 0, 0],
  impact = 0,
  expression = "idle",
  radius = 0.85,
}: BlobActorProps) {
  const groupRef = useRef<Group>(null);
  const material = useMemo(() => new GooMaterial() as unknown as ShaderMaterial, []);

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
    const stretch = speedStretch(velocity[0], velocity[1], velocity[2]);
    const squash = impactSquash(impact);
    const s = combineScale(stretch, squash);
    // Smooth toward the target deformation so it springs rather than snaps.
    const k = 1 - Math.exp(-dt / 0.06);
    g.scale.x += (s.x - g.scale.x) * k;
    g.scale.y += (s.y - g.scale.y) * k;
    g.scale.z += (s.z - g.scale.z) * k;
  });

  return (
    <group ref={groupRef}>
      <mesh material={material}>
        <sphereGeometry args={[radius, 48, 48]} />
      </mesh>
      <BlobEyes expression={expression} radius={radius} />
    </group>
  );
}
