import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { CatmullRomCurve3, type Mesh, TubeGeometry, Vector3 } from "three";
import type { TrampolineSpec } from "@/core/types";
import { getRouteProofTarget, useWorldStore } from "@/state";
import { palette } from "@/styles/tokens";

const MIN_POINTS = 2;
const RADIUS = 0.09;
const TORUS_NORMAL = new Vector3(0, 0, 1);

function applyPadNormal(out: Vector3, pad: TrampolineSpec | undefined) {
  if (pad?.type !== "canted" || !pad.cant) {
    out.set(0, 1, 0);
    return;
  }
  const [cx, cz] = pad.cant;
  const m = Math.hypot(cx, cz);
  if (m < 1e-6) {
    out.set(0, 1, 0);
    return;
  }
  const tilt = pad.cantAngleRad ?? 0;
  const s = Math.sin(tilt);
  out.set((s * cx) / m, Math.cos(tilt), (s * cz) / m).normalize();
}

export function GoldenRoutePreview() {
  const meshRef = useRef<Mesh>(null);
  const impactRef = useRef<Mesh>(null);
  const impactNormal = useRef(new Vector3(0, 1, 0));
  const activeKey = useRef("");

  useFrame(() => {
    const mesh = meshRef.current;
    const impact = impactRef.current;
    if (!mesh || !impact) return;
    const target = getRouteProofTarget();
    if (!target) {
      mesh.visible = false;
      impact.visible = false;
      activeKey.current = "";
      return;
    }

    const world = useWorldStore.getState();
    const from = world.trampolines[target.pairIndex];
    const to = world.trampolines[target.pairIndex + 1];
    const proof = from?.goldenPath;
    if (!from || !proof || proof.samples.length < MIN_POINTS) {
      mesh.visible = false;
      impact.visible = false;
      activeKey.current = "";
      return;
    }

    const key = `${world.seedPhrase}:${world.seed}:${target.pairIndex}:${from.id}:${proof.toPadId}`;
    if (key !== activeKey.current) {
      const points = proof.samples.map((p) => new Vector3(p[0], p[1], p[2]));
      const curve = new CatmullRomCurve3(points);
      const next = new TubeGeometry(curve, Math.max(8, points.length * 3), RADIUS, 8, false);
      const previous = mesh.geometry;
      mesh.geometry = next;
      previous.dispose();
      activeKey.current = key;
    }
    mesh.visible = true;
    applyPadNormal(impactNormal.current, to);
    impact.position.set(proof.landing[0], proof.landing[1] + 0.08, proof.landing[2]);
    impact.quaternion.setFromUnitVectors(TORUS_NORMAL, impactNormal.current);
    impact.visible = true;
  });

  return (
    <group renderOrder={50}>
      <mesh ref={meshRef} frustumCulled={false} renderOrder={50} visible={false}>
        <bufferGeometry />
        <meshBasicMaterial color={palette.danger} depthTest={false} depthWrite={false} />
      </mesh>
      <mesh
        ref={impactRef}
        frustumCulled={false}
        renderOrder={51}
        scale={[0.9, 0.9, 0.9]}
        visible={false}
      >
        <torusGeometry args={[1, 0.05, 8, 48]} />
        <meshBasicMaterial color={palette.danger} depthTest={false} depthWrite={false} />
      </mesh>
    </group>
  );
}
