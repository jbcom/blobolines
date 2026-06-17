import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { CatmullRomCurve3, type Mesh, TubeGeometry, Vector3 } from "three";
import { getRouteProofTarget, useWorldStore } from "@/state";
import { palette } from "@/styles/tokens";

const MIN_POINTS = 2;
const RADIUS = 0.09;

export function GoldenRoutePreview() {
  const meshRef = useRef<Mesh>(null);
  const activeKey = useRef("");

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const target = getRouteProofTarget();
    if (!target) {
      mesh.visible = false;
      activeKey.current = "";
      return;
    }

    const world = useWorldStore.getState();
    const from = world.trampolines[target.pairIndex];
    const proof = from?.goldenPath;
    if (!from || !proof || proof.samples.length < MIN_POINTS) {
      mesh.visible = false;
      activeKey.current = "";
      return;
    }

    const key = `${world.seed}:${target.pairIndex}:${from.id}:${proof.toPadId}`;
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
  });

  return (
    <mesh ref={meshRef} frustumCulled={false} renderOrder={50} visible={false}>
      <bufferGeometry />
      <meshBasicMaterial color={palette.danger} depthTest={false} depthWrite={false} />
    </mesh>
  );
}
