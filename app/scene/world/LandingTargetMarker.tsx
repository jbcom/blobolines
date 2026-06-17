import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { AdditiveBlending, type Group, type Mesh, type MeshBasicMaterial } from "three";
import { getBlobDiagnostics, useWorldStore } from "@/state";
import { hex, palette } from "@/styles/tokens";
import { nextRouteStep } from "@/world";

const BASE_Y_OFFSET = 0.05;
const MIN_RADIUS = 0.7;
const MAX_RADIUS = 1.45;

/**
 * A world-space bullseye on the certified landing point for the next route step. The marker is
 * deliberately tied to the golden-path proof, not the pad mesh, so moving pads read as timing
 * challenges: the catch point stays visible while the trampoline slides under/around it.
 */
export function LandingTargetMarker() {
  const groupRef = useRef<Group>(null);
  const activeKey = useRef("");

  useFrame((state) => {
    const group = groupRef.current;
    if (!group) return;

    const diag = getBlobDiagnostics();
    const world = useWorldStore.getState();
    const step = nextRouteStep(diag.groundY, world.trampolines);
    if (!step?.proof) {
      group.visible = false;
      activeKey.current = "";
      return;
    }

    const { target, proof } = step;
    const key = `${world.seed}:${target.id}:${proof.toPadId}:${proof.landing[0]}:${proof.landing[2]}`;
    const halfFoot = Math.max(target.width, target.depth) * 0.5;
    const radius = Math.min(MAX_RADIUS, Math.max(MIN_RADIUS, halfFoot * 0.2));
    const pulse = 1 + Math.sin(state.clock.elapsedTime * 5) * 0.06;

    group.position.set(proof.landing[0], proof.landing[1] + BASE_Y_OFFSET, proof.landing[2]);
    group.scale.setScalar(radius);
    group.visible = true;

    const outer = group.children[0] as Mesh;
    const inner = group.children[1] as Mesh;
    const beam = group.children[2] as Mesh;
    outer.scale.setScalar(pulse);
    inner.scale.setScalar(0.58 + (pulse - 1) * 0.5);
    beam.scale.set(1 / radius, 1, 1 / radius);

    if (key !== activeKey.current) {
      const precision = Math.max(0.15, proof.landingPrecision);
      (outer.material as MeshBasicMaterial).opacity = 0.35 + precision * 0.3;
      (inner.material as MeshBasicMaterial).opacity = 0.45 + precision * 0.35;
      (beam.material as MeshBasicMaterial).opacity = 0.18 + precision * 0.16;
      activeKey.current = key;
    }
  });

  return (
    <group ref={groupRef} visible={false} renderOrder={45}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} frustumCulled={false}>
        <torusGeometry args={[1, 0.035, 8, 56]} />
        <meshBasicMaterial
          color={hex(palette.tramp.gold)}
          transparent
          opacity={0.55}
          depthWrite={false}
          depthTest={false}
          blending={AdditiveBlending}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} frustumCulled={false}>
        <torusGeometry args={[1, 0.05, 8, 42]} />
        <meshBasicMaterial
          color={hex(palette.cream)}
          transparent
          opacity={0.65}
          depthWrite={false}
          depthTest={false}
          blending={AdditiveBlending}
        />
      </mesh>
      <mesh position={[0, 0.8, 0]} frustumCulled={false}>
        <cylinderGeometry args={[0.08, 0.2, 1.6, 24]} />
        <meshBasicMaterial
          color={hex(palette.tramp.gold)}
          transparent
          opacity={0.26}
          depthWrite={false}
          depthTest={false}
          blending={AdditiveBlending}
        />
      </mesh>
    </group>
  );
}
