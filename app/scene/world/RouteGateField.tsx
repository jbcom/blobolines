import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { AdditiveBlending, DoubleSide, type Group, MeshBasicMaterial } from "three";
import type { RouteGateSpec } from "@/core/types";
import { BLOB } from "@/sim/physics";
import { getBlobDiagnostics, reportRouteGateHit, useWorldStore } from "@/state";
import { palette } from "@/styles/tokens";
import { phasePortalOpen, routeGatePhase } from "@/world";

function RouteGate({ gate }: { gate: RouteGateSpec }) {
  const groupRef = useRef<Group>(null);
  const coreMatRef = useRef<MeshBasicMaterial>(null);
  const ringMatRef = useRef<MeshBasicMaterial>(null);
  const armed = useRef(true);
  const rotationY = Math.atan2(gate.normal[0], gate.normal[2]);
  const verticalBarMat = useMemo(
    () =>
      new MeshBasicMaterial({
        color: palette.danger,
        transparent: true,
        opacity: 0.45,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    [],
  );
  const horizontalBarMat = useMemo(
    () =>
      new MeshBasicMaterial({
        color: palette.tramp.orange,
        transparent: true,
        opacity: 0.4,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    [],
  );

  useEffect(() => {
    return () => {
      verticalBarMat.dispose();
      horizontalBarMat.dispose();
    };
  }, [horizontalBarMat, verticalBarMat]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const open = phasePortalOpen(gate, t);
    const phase = routeGatePhase(gate, t);
    const openCenter = gate.openFraction * 0.5;
    const openPulse = open
      ? 1 - Math.min(1, Math.abs(phase - openCenter) / Math.max(0.001, openCenter))
      : 0;
    const closedPulse = 0.5 + 0.5 * Math.sin(t * 8 + gate.routeIndex);

    const group = groupRef.current;
    if (group) {
      const scale = 1 + 0.04 * closedPulse + 0.08 * openPulse;
      group.scale.setScalar(scale);
      group.rotation.z = Math.sin(t * 1.7 + gate.routeIndex) * 0.025;
    }
    if (coreMatRef.current) {
      coreMatRef.current.opacity = open ? 0.16 + openPulse * 0.2 : 0.045;
    }
    if (ringMatRef.current) {
      ringMatRef.current.opacity = open ? 0.55 + openPulse * 0.3 : 0.72 + closedPulse * 0.18;
    }
    const barOpacity = open ? 0.05 : 0.34 + closedPulse * 0.42;
    verticalBarMat.opacity = barOpacity;
    horizontalBarMat.opacity = barOpacity;

    const blob = getBlobDiagnostics();
    const dx = blob.position[0] - gate.position[0];
    const dy = blob.position[1] - gate.position[1];
    const dz = blob.position[2] - gate.position[2];
    const d2 = dx * dx + dy * dy + dz * dz;
    const hitRadius = gate.radius + BLOB.radius * 0.55;
    if (d2 > hitRadius * hitRadius * 2.4 || !blob.airborne) {
      armed.current = true;
      return;
    }
    if (open) {
      if (d2 <= hitRadius * hitRadius) armed.current = false;
      return;
    }
    if (!armed.current || d2 > hitRadius * hitRadius) return;
    armed.current = false;
    reportRouteGateHit({
      gateId: gate.id,
      kind: gate.kind,
      position: gate.position,
      strength: 0.9,
    });
  });

  const barOffsets = [-0.48, 0, 0.48];

  return (
    <group
      ref={groupRef}
      position={[gate.position[0], gate.position[1], gate.position[2]]}
      rotation={[0, rotationY, 0]}
    >
      <mesh>
        <circleGeometry args={[gate.radius * 0.92, 48]} />
        <meshBasicMaterial
          ref={coreMatRef}
          color={palette.tramp.ice}
          transparent
          opacity={0.12}
          blending={AdditiveBlending}
          depthWrite={false}
          side={DoubleSide}
        />
      </mesh>
      <mesh>
        <torusGeometry args={[gate.radius, 0.075, 12, 72]} />
        <meshBasicMaterial
          ref={ringMatRef}
          color={palette.goo.rim}
          transparent
          opacity={0.7}
          blending={AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <group>
        {barOffsets.map((offset) => (
          <mesh
            key={`v-${offset}`}
            position={[offset * gate.radius, 0, 0.045]}
            material={verticalBarMat}
          >
            <boxGeometry args={[0.055, gate.radius * 1.55, 0.05]} />
          </mesh>
        ))}
        {barOffsets.slice(0, 2).map((offset) => (
          <mesh
            key={`h-${offset}`}
            position={[0, offset * gate.radius * 0.68, 0.05]}
            rotation={[0, 0, Math.PI / 2]}
            material={horizontalBarMat}
          >
            <boxGeometry args={[0.05, gate.radius * 1.45, 0.05]} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

export function RouteGateField() {
  const trampolines = useWorldStore((s) => s.trampolines);
  const gates = useMemo(
    () =>
      trampolines.flatMap((pad) => (pad.goldenPath?.routeGate ? [pad.goldenPath.routeGate] : [])),
    [trampolines],
  );

  return (
    <group>
      {gates.map((gate) => (
        <RouteGate key={gate.id} gate={gate} />
      ))}
    </group>
  );
}
