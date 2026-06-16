import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import type { InstancedMesh } from "three";
import { Matrix4, Quaternion, Vector3 } from "three";
import { launchVelocity } from "@/sim/launch";
import { GRAVITY } from "@/sim/physics";
import { getAim, getBlobDiagnostics, useGameStore } from "@/state";
import { hex, palette } from "@/styles/tokens";

/**
 * Aim/targeting feedback: a dotted ballistic arc showing where the blob will fly while
 * the player charges the slingshot. Reads the live aim from the bridge each frame, runs
 * the SAME launchVelocity the blob will use, and plots the gravity arc as instanced dots
 * (fading out along the path). Hidden when not aiming. This is the launch feedback the
 * PoC had and the rebuild was missing.
 */
const DOTS = 22;
const STEP = 0.07; // seconds between plotted points
const tmpPos = new Vector3();
const tmpScale = new Vector3();
const tmpQuat = new Quaternion();
const tmpMat = new Matrix4();

export function TrajectoryPreview() {
  const meshRef = useRef<InstancedMesh>(null);
  const color = useMemo(() => palette.goo.rim, []);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const aim = getAim();
    if (!aim) {
      mesh.count = 0;
      mesh.instanceMatrix.needsUpdate = true;
      return;
    }

    const [bx, by, bz] = getBlobDiagnostics().position;
    const combo = useGameStore.getState().run.combo;
    const v = launchVelocity(aim.dir, aim.charge, "standard", combo);

    // Plot the ballistic arc: p(t) = p0 + v·t + ½·g·t².
    let shown = 0;
    for (let i = 1; i <= DOTS; i++) {
      const t = i * STEP;
      const x = bx + v[0] * t;
      const y = by + v[1] * t + 0.5 * GRAVITY[1] * t * t;
      const z = bz + v[2] * t;
      // Stop the preview once it would dip below the launch height (past the apex+down a bit).
      if (y < by - 1 && i > 3) break;
      tmpPos.set(x, y, z);
      // Dots shrink along the path for a tapering aim line.
      const s = 0.16 * (1 - (i / DOTS) * 0.6);
      tmpScale.setScalar(s);
      tmpMat.compose(tmpPos, tmpQuat, tmpScale);
      mesh.setMatrixAt(shown, tmpMat);
      shown++;
    }
    mesh.count = shown;
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, DOTS]} frustumCulled={false}>
      <sphereGeometry args={[1, 8, 8]} />
      <meshBasicMaterial color={hex(color)} transparent opacity={0.7} depthWrite={false} />
    </instancedMesh>
  );
}
