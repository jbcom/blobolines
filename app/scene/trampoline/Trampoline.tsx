import { useFrame } from "@react-three/fiber";
import { CuboidCollider, type RapierRigidBody, RigidBody } from "@react-three/rapier";
import { useEffect, useMemo, useRef } from "react";
import { CanvasTexture, type Group, type Mesh } from "three";
import { playBounce } from "@/audio";
import { clamp } from "@/core/math";
import type { TrampType } from "@/core/types";
import { createSplatCanvas } from "@/render/vfx";
import {
  createTrampState,
  impactTargets,
  reboundMultiplier,
  stepTramp,
  type TrampState,
} from "@/sim/trampoline";
import { reportImpact, reportRebound, useGameStore } from "@/state";
import { mixHex, palette, trampColor } from "@/styles/tokens";

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
  const rbRef = useRef<RapierRigidBody>(null);
  const meshRef = useRef<Group>(null);
  const membraneRef = useRef<Mesh>(null);
  const spring = useRef<TrampState>(createTrampState());
  const color = trampColor[type];
  // Per-pad deterministic phase/dir for moving pads (seeded by world position).
  const movePhase = useRef((position[0] * 0.37 + position[2] * 0.91) % (Math.PI * 2));
  // Fragile pads break shortly after the first impact.
  const breaking = useRef(false);
  const breakTimer = useRef(0);

  // Target spring values (mutated on impact, decays back to 0).
  const target = useRef({ depress: 0, tiltX: 0, tiltZ: 0 });

  // Accumulating goo-splat decal painted onto the membrane top each landing. One Canvas2D
  // texture per pad; impacts smear a colored blob at the (relX,relZ) contact point.
  const splat = useMemo(() => {
    const sc = createSplatCanvas(128);
    const texture = new CanvasTexture(sc.canvas);
    return { ...sc, texture };
  }, []);
  // Release the GPU texture when the pad unmounts (tower recycles pads as you climb).
  useEffect(() => () => splat.texture.dispose(), [splat]);

  useFrame((_, dt) => {
    const g = meshRef.current;
    if (!g) return;
    const step = Math.min(dt, 1 / 30);
    spring.current = stepTramp(spring.current, target.current, step);
    // The group is a child of the RigidBody, so it's in body-LOCAL space — the depress
    // is the only Y offset; adding position[1] (the body's world Y) would double it.
    g.position.y = spring.current.depress.value;
    g.rotation.x = spring.current.tiltX.value;
    g.rotation.z = spring.current.tiltZ.value;
    target.current.depress *= 0.86;
    target.current.tiltX *= 0.86;
    target.current.tiltZ *= 0.86;

    // Moving pads glide side to side on a kinematic body (collider moves with them).
    if (type === "moving" && rbRef.current) {
      movePhase.current += step * 1.2;
      const x = position[0] + Math.sin(movePhase.current) * 5.5;
      rbRef.current.setNextKinematicTranslation({ x, y: position[1], z: position[2] });
    }

    // Fragile pads shrink + fade then vanish ~0.8s after impact.
    if (breaking.current) {
      breakTimer.current += step;
      const k = Math.max(0, 1 - breakTimer.current / 0.8);
      g.scale.setScalar(k);
      g.visible = k > 0.02;
    }
  });

  const emissive = useMemo(() => color, [color]);
  // Membrane = mostly bright cream but pulled ~45% toward the pad type color so each pad
  // reads its own hue from above (the top face is what the camera mostly sees).
  const membraneColor = useMemo(() => mixHex(palette.cream, color, 0.45), [color]);

  return (
    <RigidBody
      ref={rbRef}
      type={type === "moving" ? "kinematicPosition" : "fixed"}
      position={[position[0], position[1], position[2]]}
      colliders={false}
    >
      {/* Solid collider for the pad body. */}
      <CuboidCollider args={[width / 2, THICKNESS / 2, depth / 2]} />
      {/* Sensor just above the surface to detect + measure landings. */}
      <CuboidCollider
        args={[width / 2, 0.2, depth / 2]}
        position={[0, THICKNESS / 2 + 0.2, 0]}
        sensor
        onIntersectionEnter={(e) => {
          const other = e.other.rigidBody;
          // Guard against a peer whose handle was invalidated this frame (the render window
          // can unmount a pad's body, and a stale handle would throw on linvel/translation).
          if (!other || other.isValid?.() === false) return;
          const lv = other.linvel();
          // Only react to a descending blob (ignore the upward exit through the sensor).
          if (!lv || lv.y >= 0) return;
          const speed = Math.abs(lv.y);
          // Relative hit point on the pad ([-0.5,0.5] each axis) → off-center hits tilt
          // the pad toward the contact, deflecting the bounce (no longer hardcoded 0).
          const bt = other.translation();
          const relX = clamp((bt.x - position[0]) / width, -0.5, 0.5);
          const relZ = clamp((bt.z - position[2]) / depth, -0.5, 0.5);
          target.current = impactTargets(speed, relX, relZ);
          // Smear a goo splat on the membrane at the contact point, sized by impact and
          // tinted to the blob's current skin. Accumulates across landings.
          const skin = useGameStore.getState().progress.skin;
          const size = clamp(0.1 + speed / 60, 0.1, 0.32);
          splat.paint(relX + 0.5, relZ + 0.5, palette.blob[skin], size);
          splat.texture.needsUpdate = true;
          reportImpact(speed);
          // Trampoline rebound: bounce back at impact speed × type multiplier, with a
          // floor so even a gentle landing pops (the pad is springy). The blob's
          // slingshot drag adds an extra charged launch on top.
          const reboundSpeed = Math.max(speed, 8) * reboundMultiplier[type];
          reportRebound({ speed: reboundSpeed, type });
          playBounce(type);
          // Fragile pads start disintegrating after this bounce (gives one last launch).
          if (type === "fragile") breaking.current = true;
          onImpact?.(speed, relX, relZ);
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
        {/* glossy membrane (the bounce surface) — tinted toward the pad TYPE color (was
            always cream, which made every pad read the same and the world colorless), with
            a punchy emissive so each type glows its own hue. */}
        <mesh ref={membraneRef} position={[0, THICKNESS / 2 + 0.02, 0]}>
          <boxGeometry args={[width * 0.92, 0.18, depth * 0.92]} />
          <meshStandardMaterial
            color={membraneColor}
            emissive={emissive}
            emissiveIntensity={0.5}
            roughness={0.2}
            metalness={0.15}
          />
        </mesh>
        {/* Accumulating goo-splat decal — a transparent plane skimming the membrane top,
            painted by the Canvas2D splat texture on each landing. polygonOffset lifts it
            above the membrane to avoid z-fighting. */}
        <mesh position={[0, THICKNESS / 2 + 0.02 + 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[width * 0.92, depth * 0.92]} />
          <meshBasicMaterial
            map={splat.texture}
            transparent
            depthWrite={false}
            polygonOffset
            polygonOffsetFactor={-1}
          />
        </mesh>
      </group>
    </RigidBody>
  );
}
