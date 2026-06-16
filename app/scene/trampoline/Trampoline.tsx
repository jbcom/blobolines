import { useFrame } from "@react-three/fiber";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { useMemo, useRef } from "react";
import type { Group, Mesh } from "three";
import type { TrampType } from "@/core/types";
import { createTrampState, impactTargets, stepTramp, type TrampState } from "@/sim/trampoline";
import { reportImpact } from "@/state";
import { trampColor } from "@/styles/tokens";

/**
 * A single trampoline: a fixed Rapier body (the blob bounces off it) with a squishy
 * animated mesh that depresses + tilts on impact via the spring model, then springs
 * back. The membrane (top surface) carries the bounce; a sensor reports impacts so the
 * game loop can launch the blob and play juice.
 */

interface TrampolineProps {
  position: readonly [number, number, number];
  width: number;
  depth: number;
  type: TrampType;
  /** Called when the blob lands, with impact speed + relative hit point. */
  onImpact?: (speed: number, relX: number, relZ: number) => void;
}

const THICKNESS = 1.2;

export function Trampoline({ position, width, depth, type, onImpact }: TrampolineProps) {
  const meshRef = useRef<Group>(null);
  const membraneRef = useRef<Mesh>(null);
  const spring = useRef<TrampState>(createTrampState());
  const color = trampColor[type];

  // Target spring values (mutated on impact, decays back to 0).
  const target = useRef({ depress: 0, tiltX: 0, tiltZ: 0 });

  useFrame((_, dt) => {
    const g = meshRef.current;
    if (!g) return;
    spring.current = stepTramp(spring.current, target.current, Math.min(dt, 1 / 30));
    // The group is a child of the RigidBody, so it's in body-LOCAL space — the depress
    // is the only Y offset; adding position[1] (the body's world Y) would double it.
    g.position.y = spring.current.depress.value;
    g.rotation.x = spring.current.tiltX.value;
    g.rotation.z = spring.current.tiltZ.value;
    // Decay impact target back to rest so it springs up.
    target.current.depress *= 0.86;
    target.current.tiltX *= 0.86;
    target.current.tiltZ *= 0.86;
  });

  const emissive = useMemo(() => color, [color]);

  return (
    <RigidBody type="fixed" position={[position[0], position[1], position[2]]} colliders={false}>
      {/* Solid collider for the pad body. */}
      <CuboidCollider args={[width / 2, THICKNESS / 2, depth / 2]} />
      {/* Sensor just above the surface to detect + measure landings. */}
      <CuboidCollider
        args={[width / 2, 0.2, depth / 2]}
        position={[0, THICKNESS / 2 + 0.2, 0]}
        sensor
        onIntersectionEnter={(e) => {
          const lv = e.other.rigidBody?.linvel();
          const speed = lv ? Math.abs(lv.y) : 0;
          const t = impactTargets(speed, 0, 0);
          target.current = t;
          reportImpact(speed);
          onImpact?.(speed, 0, 0);
        }}
      />
      <group ref={meshRef} position={[0, 0, 0]}>
        {/* pad base */}
        <mesh>
          <boxGeometry args={[width, THICKNESS, depth]} />
          <meshStandardMaterial
            color={color}
            emissive={emissive}
            emissiveIntensity={0.35}
            roughness={0.4}
            metalness={0.1}
          />
        </mesh>
        {/* glossy membrane (the bounce surface) */}
        <mesh ref={membraneRef} position={[0, THICKNESS / 2 + 0.02, 0]}>
          <boxGeometry args={[width * 0.92, 0.18, depth * 0.92]} />
          <meshStandardMaterial
            color="#ffffff"
            emissive={emissive}
            emissiveIntensity={0.6}
            roughness={0.15}
          />
        </mesh>
      </group>
    </RigidBody>
  );
}
