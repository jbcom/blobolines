import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Group, Mesh } from "three";
import type { EyeExpression } from "@/core/types";
import { mouthShape } from "@/sim/blob";
import { getAim, getBlobDiagnostics } from "@/state";
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

const MOUTH_Y = -0.3; // below the eyes on the face

export function BlobMouth({ expression, radius, live = false }: BlobMouthProps) {
  const groupRef = useRef<Group>(null);
  const lipRef = useRef<Mesh>(null);
  const cornerL = useRef<Mesh>(null);
  const cornerR = useRef<Mesh>(null);

  useFrame((state) => {
    const g = groupRef.current;
    if (!g) return;
    const diag = live ? getBlobDiagnostics() : null;
    const expr = diag?.expression ?? expression;
    const aim = live ? getAim() : null;
    const charge = aim?.charge ?? 0;
    const impatience = Math.min(1, Math.max(0, ((diag?.idleSeconds ?? 0) - 2.2) / 3.2));
    const excitement = diag?.excitement ?? 0;
    const heroIdle = live ? 0 : Math.max(0, Math.sin(state.clock.elapsedTime * 1.5 + 0.4)) * 0.22;
    const m = mouthShape(expr);
    const open = Math.min(
      1,
      m.open + charge * 0.48 + impatience * 0.18 + excitement * 0.25 + heroIdle * 0.12,
    );
    const width = m.width + charge * 0.2 + impatience * 0.12 + excitement * 0.16 + heroIdle * 0.08;
    const curve = Math.max(
      -1,
      Math.min(1, m.curve + charge * 0.25 + excitement * 0.32 + heroIdle * 0.2),
    );

    // The lip ellipse: width = mouth width, height = openness (a flat smile when ~closed,
    // a tall "o" when open).
    const lip = lipRef.current;
    if (lip) lip.scale.set(width, 0.16 + open * 1.05, 1);

    // Corners lift (smile) or drop (frown) by the curve, and pull in slightly when open.
    const lift = curve * 0.14;
    const cx = 0.25 * width * (1 - open * 0.18);
    if (cornerL.current) cornerL.current.position.set(-cx, lift, 0.01);
    if (cornerR.current) cornerR.current.position.set(cx, lift, 0.01);
  });

  return (
    <group ref={groupRef} position={[0, MOUTH_Y, radius * 0.22]} renderOrder={11}>
      {/* main lip — dark rounded mouth (ellipse via non-uniform scale on a sphere) */}
      <mesh ref={lipRef} renderOrder={11}>
        <sphereGeometry args={[0.2, 20, 16]} />
        <meshBasicMaterial color={palette.eye.bezel} depthTest={false} />
      </mesh>
      {/* mouth corners — lift for a smile, drop for a frown */}
      <mesh ref={cornerL} renderOrder={11}>
        <sphereGeometry args={[0.065, 12, 12]} />
        <meshBasicMaterial color={palette.eye.bezel} depthTest={false} />
      </mesh>
      <mesh ref={cornerR} renderOrder={11}>
        <sphereGeometry args={[0.065, 12, 12]} />
        <meshBasicMaterial color={palette.eye.bezel} depthTest={false} />
      </mesh>
    </group>
  );
}
