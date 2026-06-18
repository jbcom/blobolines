import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import {
  AdditiveBlending,
  CatmullRomCurve3,
  DoubleSide,
  type Mesh,
  TubeGeometry,
  Vector3,
} from "three";
import type { TrampolineSpec } from "@/core/types";
import { getRouteProofTarget, useWorldStore } from "@/state";
import { palette } from "@/styles/tokens";

const MIN_POINTS = 2;
const RADIUS = 0.045;
const FRAGMENT_RADIUS = 0.032;
const MAX_FRAGMENT_LANES = 5;
const RING_NORMAL = new Vector3(0, 0, 1);

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
  const fragmentRefs = useRef<(Mesh | null)[]>(Array(MAX_FRAGMENT_LANES).fill(null));
  const impactRef = useRef<Mesh>(null);
  const impactNormal = useRef(new Vector3(0, 1, 0));
  const activeKey = useRef("");

  const hideFragments = () => {
    for (const fragment of fragmentRefs.current) {
      if (fragment) fragment.visible = false;
    }
  };

  useFrame(() => {
    const mesh = meshRef.current;
    const impact = impactRef.current;
    if (!mesh || !impact) return;
    const target = getRouteProofTarget();
    if (!target) {
      mesh.visible = false;
      impact.visible = false;
      hideFragments();
      activeKey.current = "";
      return;
    }

    const world = useWorldStore.getState();
    const from = world.trampolines[target.pairIndex];
    const to = world.trampolines[target.pairIndex + 1];
    const proof = from?.goldenPath;
    if (!from || !to || !proof || proof.samples.length < MIN_POINTS) {
      mesh.visible = false;
      impact.visible = false;
      hideFragments();
      activeKey.current = "";
      return;
    }

    const gate = proof.routeGate?.kind === "slicer" ? proof.routeGate : null;
    const visibleSamples = gate ? proof.samples.slice(0, gate.sampleIndex + 1) : proof.samples;
    if (visibleSamples.length < MIN_POINTS) {
      mesh.visible = false;
      impact.visible = false;
      hideFragments();
      activeKey.current = "";
      return;
    }

    const laneKey =
      gate?.fragmentLanes
        ?.map((lane) => `${lane.index}:${lane.samples.length}:${lane.landingPrecision.toFixed(3)}`)
        .join("|") ?? "none";
    const key = `${world.seedPhrase}:${world.seed}:${target.pairIndex}:${from.id}:${proof.toPadId}:${gate?.id ?? "full"}:${laneKey}`;
    if (key !== activeKey.current) {
      const points = visibleSamples.map((p) => new Vector3(p[0], p[1], p[2]));
      const curve = new CatmullRomCurve3(points);
      const next = new TubeGeometry(curve, Math.max(16, points.length * 4), RADIUS, 14, false);
      const previous = mesh.geometry;
      mesh.geometry = next;
      previous.dispose();

      for (let i = 0; i < MAX_FRAGMENT_LANES; i++) {
        const fragment = fragmentRefs.current[i];
        if (!fragment) continue;
        const lane = gate?.fragmentLanes?.[i];
        if (!lane || lane.samples.length < MIN_POINTS) {
          fragment.visible = false;
          continue;
        }
        const lanePoints = lane.samples.map((p) => new Vector3(p[0], p[1], p[2]));
        const laneCurve = new CatmullRomCurve3(lanePoints);
        const laneGeometry = new TubeGeometry(
          laneCurve,
          Math.max(10, lanePoints.length * 3),
          lane.survivor ? FRAGMENT_RADIUS * 1.25 : FRAGMENT_RADIUS,
          10,
          false,
        );
        const oldLaneGeometry = fragment.geometry;
        fragment.geometry = laneGeometry;
        oldLaneGeometry.dispose();
      }
      activeKey.current = key;
    }
    mesh.visible = true;
    for (let i = 0; i < MAX_FRAGMENT_LANES; i++) {
      const fragment = fragmentRefs.current[i];
      if (fragment) fragment.visible = Boolean(gate?.fragmentLanes?.[i]);
    }
    if (gate) {
      impactNormal.current.set(...gate.normal).normalize();
    } else {
      applyPadNormal(impactNormal.current, to);
    }
    const impactPosition = gate?.position ?? proof.landing;
    impact.position.set(impactPosition[0], impactPosition[1] + 0.08, impactPosition[2]);
    impact.quaternion.setFromUnitVectors(RING_NORMAL, impactNormal.current);
    impact.visible = true;
  });

  return (
    <group renderOrder={50}>
      <mesh ref={meshRef} frustumCulled={false} renderOrder={50} visible={false}>
        <bufferGeometry />
        <meshBasicMaterial color={palette.danger} depthTest={false} depthWrite={false} />
      </mesh>
      {Array.from({ length: MAX_FRAGMENT_LANES }, (_, i) => (
        <mesh
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed proof-lane pool
          key={i}
          ref={(node) => {
            fragmentRefs.current[i] = node;
          }}
          frustumCulled={false}
          renderOrder={50}
          visible={false}
        >
          <bufferGeometry />
          <meshBasicMaterial
            color={i === 0 ? palette.tramp.gold : palette.tramp.orange}
            transparent
            opacity={i === 0 ? 0.72 : 0.42}
            depthTest={false}
            depthWrite={false}
            blending={AdditiveBlending}
          />
        </mesh>
      ))}
      <mesh
        ref={impactRef}
        frustumCulled={false}
        renderOrder={51}
        scale={[1.15, 1.15, 1.15]}
        visible={false}
      >
        <ringGeometry args={[0.72, 1.12, 72]} />
        <meshBasicMaterial
          color={palette.danger}
          transparent
          opacity={0.82}
          depthTest={false}
          depthWrite={false}
          side={DoubleSide}
          blending={AdditiveBlending}
        />
      </mesh>
    </group>
  );
}
