import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { CanvasTexture, type Color, type Group, type ShaderMaterial, SRGBColorSpace } from "three";
import { playBounce } from "@/audio";
import { biomeSkyAt, trampoline as trampCfg } from "@/config";
import { clamp } from "@/core/math";
import type { TrampType } from "@/core/types";
import { GooMaterial } from "@/render/materials";
import { getQuality } from "@/render/qualityBridge";
import { createSplatCanvas } from "@/render/vfx";
import { cloudCatch } from "@/sim/cloudPad";
import { MAX_IMPACT_SPEED } from "@/sim/physics";
import { createTrampState, impactTargets, stepTramp, type TrampState } from "@/sim/trampoline";
import {
  getBlobDiagnostics,
  getRouteProofTarget,
  reportCloudAdherence,
  reportImpact,
  reportLanding,
  useGameStore,
} from "@/state";
import { hex, mixHex, palette, trampColor } from "@/styles/tokens";

interface TrampolineProps {
  id: number;
  routeIndex?: number;
  position: readonly [number, number, number];
  width: number;
  depth: number;
  type: TrampType;
  /** Lateral route direction for canted clouds. */
  cant?: readonly [number, number];
  /** Optional per-cloud cant strength in radians. */
  cantAngleRad?: number;
  /** Unit [x,z] drift rail direction for moving clouds. */
  moveAxis?: readonly [number, number];
  /** Called when Blobby catches the cloud, with impact speed + relative hit point. */
  onImpact?: (speed: number, relX: number, relZ: number) => void;
}

const { movingAmplitude, movingSpeed } = trampCfg;

const CLOUD_LOBES = [
  { id: "center", position: [0, 0, 0], scale: [0.52, 0.28, 0.38] },
  { id: "left", position: [-0.3, 0.1, -0.08], scale: [0.28, 0.2, 0.26] },
  { id: "right", position: [0.32, 0.12, 0.02], scale: [0.3, 0.22, 0.24] },
  { id: "back", position: [-0.05, 0.18, 0.3], scale: [0.26, 0.22, 0.24] },
  { id: "front", position: [0.08, -0.02, -0.32], scale: [0.3, 0.18, 0.22] },
] as const;

function unit2(v: readonly [number, number] | undefined): readonly [number, number] {
  const [x, z] = v ?? [1, 0];
  const m = Math.hypot(x, z);
  return m < 1e-6 ? [1, 0] : [x / m, z / m];
}

function CloudTypeWisps({
  type,
  width,
  depth,
  cant,
  moveAxis,
}: {
  type: TrampType;
  width: number;
  depth: number;
  cant?: readonly [number, number];
  moveAxis?: readonly [number, number];
}) {
  const tint = hex(trampColor[type]);
  const radius = Math.max(width, depth) * 0.08;
  if (type === "moving") {
    const [x, z] = unit2(moveAxis);
    const angle = Math.atan2(z, x);
    return (
      <group rotation={[0, -angle, 0]}>
        {[-0.24, 0, 0.24].map((offset) => (
          <mesh key={offset} position={[offset * width, 0.58, 0]} scale={[1.8, 0.28, 0.28]}>
            <sphereGeometry args={[radius, 18, 12]} />
            <meshBasicMaterial color={tint} transparent opacity={0.32} />
          </mesh>
        ))}
      </group>
    );
  }
  if (type === "fragile") {
    return (
      <group>
        {[-0.36, -0.16, 0.18, 0.38].map((offset, i) => (
          <mesh
            key={offset}
            position={[offset * width, 0.38 + i * 0.04, (i % 2 ? -0.28 : 0.25) * depth]}
          >
            <sphereGeometry args={[radius * (1.2 - i * 0.12), 14, 10]} />
            <meshBasicMaterial color={tint} transparent opacity={0.42} />
          </mesh>
        ))}
      </group>
    );
  }
  if (type === "wobbler") {
    return (
      <group rotation={[0.12, 0, -0.16]}>
        <mesh position={[0, 0.62, 0]} scale={[1.5, 0.22, 0.78]}>
          <sphereGeometry args={[radius, 24, 12]} />
          <meshBasicMaterial color={tint} transparent opacity={0.34} />
        </mesh>
      </group>
    );
  }
  if (type === "canted" && cant) {
    const [x, z] = unit2(cant);
    const angle = Math.atan2(z, x);
    return (
      <group rotation={[0, -angle, 0]}>
        {[0.04, 0.2, 0.36].map((offset, i) => (
          <mesh key={offset} position={[offset * width, 0.58 + i * 0.03, 0]}>
            <sphereGeometry args={[radius * (1.25 - i * 0.18), 18, 10]} />
            <meshBasicMaterial color={tint} transparent opacity={0.38} />
          </mesh>
        ))}
      </group>
    );
  }
  if (type === "booster" || type === "super") {
    return (
      <mesh position={[0, -0.12, 0]} scale={[1.2, 0.18, 1.2]}>
        <sphereGeometry args={[Math.max(width, depth) * 0.28, 32, 12]} />
        <meshBasicMaterial color={tint} transparent opacity={type === "super" ? 0.36 : 0.24} />
      </mesh>
    );
  }
  if (type === "ice") {
    return (
      <mesh position={[0, 0.5, 0]} scale={[1.1, 0.16, 0.9]}>
        <sphereGeometry args={[Math.max(width, depth) * 0.19, 24, 12]} />
        <meshBasicMaterial color={hex(palette.cloud.glow)} transparent opacity={0.32} />
      </mesh>
    );
  }
  return null;
}

/**
 * Cloud pad. The legacy component name is kept while the repo migrates, but this is no longer
 * a rigid trampoline: it is a lumpy goo-cloud sensor. Blobby can pass upward through it; once
 * descending inside the cloud volume, it reports soft adherence so the player can charge the
 * next launch from the caught state.
 */
export function Trampoline({
  id,
  routeIndex,
  position,
  width,
  depth,
  type,
  cant,
  moveAxis,
  onImpact,
}: TrampolineProps) {
  const rootRef = useRef<Group>(null);
  const cloudRef = useRef<Group>(null);
  const spring = useRef<TrampState>(createTrampState());
  const target = useRef({ depress: 0, tiltX: 0, tiltZ: 0 });
  const movePhase = useRef((position[0] * 0.37 + position[2] * 0.91) % (Math.PI * 2));
  const caught = useRef(false);
  const lastImpactAt = useRef(-Infinity);
  const breaking = useRef(false);
  const breakTimer = useRef(0);
  const livePosition = useRef<[number, number, number]>([position[0], position[1], position[2]]);

  const color = trampColor[type];
  const sliderAxis = useMemo(() => unit2(moveAxis), [moveAxis]);

  const material = useMemo(() => new GooMaterial() as unknown as ShaderMaterial, []);
  useEffect(() => () => material.dispose(), [material]);

  const cloudColor = useMemo(() => {
    const biome = biomeSkyAt(position[1]);
    const base =
      type === "wobbler" || type === "fragile" ? palette.cloud.blush : palette.cloud.puff;
    return mixHex(mixHex(base, color, 0.14), biome.mid, 0.12);
  }, [color, position, type]);
  const cloudHeight = Math.max(0.92, Math.min(1.28, Math.max(width, depth) * 0.15));

  useEffect(() => {
    (material.uniforms.uColor.value as Color).set(cloudColor);
    (material.uniforms.uRim.value as Color).set(palette.cloud.glow);
    material.uniforms.uWet.value = 0.76;
    material.uniforms.uSag.value = 0.55;
    material.uniforms.uLobe.value = 0.45;
  }, [cloudColor, material]);

  const splat = useMemo(() => {
    const sc = createSplatCanvas(getQuality().splatResolution);
    const texture = new CanvasTexture(sc.canvas);
    texture.colorSpace = SRGBColorSpace;
    return { ...sc, texture };
  }, []);
  useEffect(() => () => splat.texture.dispose(), [splat]);

  useFrame((state, dt) => {
    const root = rootRef.current;
    const cloud = cloudRef.current;
    if (!root || !cloud) return;
    const step = Math.min(dt, 1 / 30);
    const proofTarget = getRouteProofTarget();
    const frozenForProof =
      proofTarget &&
      routeIndex !== undefined &&
      (routeIndex === proofTarget.pairIndex || routeIndex === proofTarget.pairIndex + 1);

    let x = position[0];
    let z = position[2];
    if (type === "moving" && !frozenForProof) {
      movePhase.current += step * movingSpeed;
      const offset = Math.sin(movePhase.current) * movingAmplitude;
      x += sliderAxis[0] * offset;
      z += sliderAxis[1] * offset;
    }
    livePosition.current = [x, position[1], z];
    root.position.set(x, position[1], z);

    spring.current = stepTramp(spring.current, target.current, step);
    const depress = spring.current.depress.value;
    const breathe = Math.sin(state.clock.elapsedTime * 1.15 + id * 0.07) * 0.035;
    const stress = Math.min(1, -depress / 5.4);
    cloud.position.y = depress * 0.18 + breathe;
    cloud.rotation.x = spring.current.tiltX.value * 0.22;
    cloud.rotation.z = spring.current.tiltZ.value * 0.22;
    cloud.scale.set(1 + stress * 0.08, 1 - stress * 0.16, 1 + stress * 0.08);
    target.current.depress *= 0.86;
    target.current.tiltX *= 0.86;
    target.current.tiltZ *= 0.86;

    material.uniforms.uTime.value = state.clock.elapsedTime;
    material.uniforms.uWobble.value = 0.16 + stress * 0.8 + Math.abs(breathe) * 1.5;
    material.uniforms.uEnvLight.value = Math.min(0.62, 0.12 + position[1] / 1600);
    (material.uniforms.uEnvTint.value as Color).set(biomeSkyAt(position[1]).top);

    if (breaking.current) {
      breakTimer.current += step;
      const k = Math.max(0, 1 - breakTimer.current / 1.1);
      cloud.scale.multiplyScalar(k);
      root.visible = k > 0.03;
    }

    const diag = getBlobDiagnostics();
    const hit = cloudCatch({
      padPosition: livePosition.current,
      width,
      depth,
      blobPosition: diag.position,
      blobVelocity: diag.velocity,
    });

    if (!hit) {
      caught.current = false;
      return;
    }

    reportCloudAdherence({
      padId: id,
      type,
      position: [livePosition.current[0], hit.contactY, livePosition.current[2]],
      settleY: hit.settleY,
      relX: hit.relX,
      relZ: hit.relZ,
      strength: hit.strength,
    });

    const now = state.clock.elapsedTime;
    const freshCatch = !caught.current && now - lastImpactAt.current > 0.22;
    if (!freshCatch || diag.velocity[1] > -0.35) {
      caught.current = true;
      return;
    }

    caught.current = true;
    lastImpactAt.current = now;
    target.current = impactTargets(hit.speed, hit.relX, hit.relZ);

    const skin = useGameStore.getState().progress.skin;
    const size = clamp(0.18 + hit.speed / 34, 0.18, 0.55);
    splat.paint(hit.relX + 0.5, hit.relZ + 0.5, palette.blob[skin], size);
    if (hit.speed > 9) {
      splat.paint(hit.relX + 0.5 + 0.12, hit.relZ + 0.5 - 0.08, palette.blob[skin], size * 0.6);
      splat.paint(hit.relX + 0.5 - 0.1, hit.relZ + 0.5 + 0.11, palette.blob[skin], size * 0.5);
    }
    splat.texture.needsUpdate = true;

    reportImpact(hit.speed);
    reportLanding({
      padId: id,
      speed: hit.speed,
      position: [diag.position[0], hit.contactY, diag.position[2]],
      relX: hit.relX,
      relZ: hit.relZ,
    });

    playBounce(type, Math.min(1, hit.speed / MAX_IMPACT_SPEED));
    if (type === "fragile") breaking.current = true;
    onImpact?.(hit.speed, hit.relX, hit.relZ);
  });

  return (
    <group ref={rootRef} position={position}>
      <group ref={cloudRef}>
        {CLOUD_LOBES.map((lobe) => (
          <mesh
            key={lobe.id}
            material={material}
            position={[
              lobe.position[0] * width,
              lobe.position[1] * cloudHeight,
              lobe.position[2] * depth,
            ]}
            scale={[
              width * lobe.scale[0],
              cloudHeight * (0.45 + lobe.scale[1]),
              depth * lobe.scale[2],
            ]}
            frustumCulled={false}
          >
            <sphereGeometry args={[1, 24, 16]} />
          </mesh>
        ))}
        <CloudTypeWisps type={type} width={width} depth={depth} cant={cant} moveAxis={moveAxis} />
        <mesh position={[0, 0.74, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[Math.max(width, depth) * 0.32, 48]} />
          <meshStandardMaterial
            map={splat.texture}
            transparent
            depthWrite={false}
            roughness={0.25}
            metalness={0.05}
            polygonOffset
            polygonOffsetFactor={-1}
          />
        </mesh>
      </group>
    </group>
  );
}
