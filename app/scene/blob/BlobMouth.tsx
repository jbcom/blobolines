import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Group, Mesh } from "three";
import type { EyeExpression } from "@/core/types";
import { mouthShape } from "@/sim/blob";
import { getBlobDiagnostics } from "@/state";
import { palette } from "@/styles/tokens";

/**
 * Procedural mouth for Blobby — expressiveness beyond the eyes. A dark rounded mouth below
 * the eyes whose openness/width/curve animate by expression (idle smile, "wheee" open on
 * launch, grimace on hard impact, dread "o" near death). Drawn on TOP of the goo (depthTest
 * off + high renderOrder) like the eyes, driven off the diagnostics bridge — no re-render.
 */
interface BlobMouthProps {
  expression: EyeExpression;
  radius: number;
  live?: boolean;
}

const MOUTH_Y = -0.34; // below the eyes on the face

export function BlobMouth({ expression, radius, live = false }: BlobMouthProps) {
  const groupRef = useRef<Group>(null);
  const lipRef = useRef<Mesh>(null);
  const cornerL = useRef<Mesh>(null);
  const cornerR = useRef<Mesh>(null);

  useFrame(() => {
    const g = groupRef.current;
    if (!g) return;
    const expr = live ? getBlobDiagnostics().expression : expression;
    const m = mouthShape(expr);

    // The lip ellipse: width = mouth width, height = openness (a flat smile when ~closed,
    // a tall "o" when open).
    const lip = lipRef.current;
    if (lip) lip.scale.set(m.width, 0.18 + m.open * 0.9, 1);

    // Corners lift (smile) or drop (frown) by the curve, and pull in slightly when open.
    const lift = m.curve * 0.12;
    const cx = 0.22 * m.width;
    if (cornerL.current) cornerL.current.position.set(-cx, lift, 0.01);
    if (cornerR.current) cornerR.current.position.set(cx, lift, 0.01);
  });

  return (
    <group ref={groupRef} position={[0, MOUTH_Y, radius * 0.16]} renderOrder={11}>
      {/* main lip — dark rounded mouth (ellipse via non-uniform scale on a sphere) */}
      <mesh ref={lipRef} renderOrder={11}>
        <sphereGeometry args={[0.16, 20, 16]} />
        <meshBasicMaterial color={palette.eye.bezel} depthTest={false} />
      </mesh>
      {/* mouth corners — lift for a smile, drop for a frown */}
      <mesh ref={cornerL} renderOrder={11}>
        <sphereGeometry args={[0.05, 12, 12]} />
        <meshBasicMaterial color={palette.eye.bezel} depthTest={false} />
      </mesh>
      <mesh ref={cornerR} renderOrder={11}>
        <sphereGeometry args={[0.05, 12, 12]} />
        <meshBasicMaterial color={palette.eye.bezel} depthTest={false} />
      </mesh>
    </group>
  );
}
