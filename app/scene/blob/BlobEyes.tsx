import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Group } from "three";
import type { EyeExpression } from "@/core/types";
import { eyeShape } from "@/sim/blob";
import { getBlobDiagnostics } from "@/state";
import { palette } from "@/styles/tokens";
import { BlobMouth } from "./BlobMouth";

/**
 * Procedural blob eyes — NOT sprites. Each eye is a big white sclera sphere with a thin
 * dark bezel ring and a big black pupil, mounted on the front of the blob face and
 * scaled to express emotion (blink/squint/wide/tear) via the eyeShape() model. A tear
 * droplet shows on the lower lid when the blob is falling toward death.
 */

interface BlobEyesProps {
  expression: EyeExpression;
  radius: number;
  /** Read the live expression from the diagnostics bridge each frame (in-game blob). */
  live?: boolean;
}

const EYE_OFFSET_X = 0.3;
const EYE_OFFSET_Y = 0.08;

function Eye({ side }: { side: 1 | -1 }) {
  // Eyes draw on TOP of the opaque goo (depthTest off + high renderOrder) so the
  // metaball body never occludes them; they read as painted onto the goo face.
  return (
    <group position={[side * EYE_OFFSET_X, EYE_OFFSET_Y, 0]} renderOrder={10}>
      {/* dark bezel ring behind the sclera (lid — squashes on blink/squint) */}
      <mesh position={[0, 0, 0.005]} name={`lid-${side}`} renderOrder={10}>
        <sphereGeometry args={[0.2, 24, 24]} />
        <meshBasicMaterial color={palette.eye.bezel} depthTest={false} />
      </mesh>
      {/* white sclera, pushed forward onto the face (lid) */}
      <mesh position={[0, 0, 0.04]} name={`lid-${side}b`} renderOrder={11}>
        <sphereGeometry args={[0.18, 24, 24]} />
        <meshBasicMaterial color={palette.eye.sclera} depthTest={false} />
      </mesh>
      {/* big black pupil */}
      <mesh position={[0, 0, 0.18]} name={`pupil-${side}`} renderOrder={12}>
        <sphereGeometry args={[0.09, 20, 20]} />
        <meshBasicMaterial color={palette.eye.pupil} depthTest={false} />
      </mesh>
      {/* glint */}
      <mesh position={[0.03, 0.04, 0.25]} renderOrder={13}>
        <sphereGeometry args={[0.025, 8, 8]} />
        <meshBasicMaterial color={palette.eye.glint} depthTest={false} />
      </mesh>
      {/* tear droplet — revealed by the animator when tearing */}
      <mesh position={[0, -0.18, 0.2]} name={`tear-${side}`} visible={false} renderOrder={12}>
        <sphereGeometry args={[0.05, 12, 12]} />
        <meshBasicMaterial color={palette.eye.tear} transparent opacity={0.85} depthTest={false} />
      </mesh>
    </group>
  );
}

export function BlobEyes({ expression, radius, live = false }: BlobEyesProps) {
  const groupRef = useRef<Group>(null);
  const timer = useRef(0);

  useFrame((_, dt) => {
    const g = groupRef.current;
    if (!g) return;
    timer.current += dt;

    // Spontaneous blink roughly every ~3.5s: a quick down-up over ~0.14s.
    const cycle = timer.current % 3.5;
    const blink = cycle < 0.14 ? Math.sin((cycle / 0.14) * Math.PI) : 0;

    const expr = live ? getBlobDiagnostics().expression : expression;
    const shape = eyeShape(expr, blink);
    // Keep the parent group UNIFORM so pupils/tears stay round; the vertical eye
    // opening (blink/squint/wide) is applied only to the lid meshes (sclera + bezel).
    g.scale.setScalar(shape.scale * radius);

    const tearing = shape.tear > 0;
    g.traverse((o) => {
      if (o.name.startsWith("lid-")) o.scale.set(1, shape.openY, 1);
      else if (o.name.startsWith("pupil-")) o.scale.setScalar(shape.pupil);
      else if (o.name.startsWith("tear-")) o.visible = tearing;
    });
  });

  return (
    <>
      <group ref={groupRef} position={[0, 0, radius * 0.15]}>
        <Eye side={-1} />
        <Eye side={1} />
      </group>
      {/* Mouth lives outside the eye group so blink/squint scaling doesn't warp it. */}
      <BlobMouth expression={expression} radius={radius} live={live} />
    </>
  );
}
