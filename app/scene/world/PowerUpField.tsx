import { useFrame, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useRef } from "react";
import { AdditiveBlending, type Group, type Mesh, type MeshBasicMaterial } from "three";
import { playPowerup } from "@/audio";
import type { PowerUpType } from "@/core/types";
import { activatePowerup, getBlobDiagnostics, useWorldStore } from "@/state";
import { palette } from "@/styles/tokens";
import { PowerUpModel } from "./PowerUpModel";

/**
 * PowerUpField — renders the generated power-ups (magnet = blue torus, thruster = orange
 * cone), bobs/spins them, and activates the matching power-up when the blob touches one.
 * Power-up positions come from the world store; a local "collected" set hides taken ones.
 */
const PICKUP_R2 = (0.75 + 0.85) * (0.75 + 0.85);

const AURA_COLOR: Record<PowerUpType, string> = {
  magnet: palette.tramp.blue,
  thruster: palette.tramp.orange,
  shield: palette.tramp.ice,
};
const FLASH_LIFE = 0.3; // seconds the collect flash plays

export function PowerUpField() {
  const groupRef = useRef<Group>(null);
  const powerups = useWorldStore((s) => s.powerups);
  const collected = useRef<Set<number>>(new Set());
  /** index → seconds-since-collected, drives the collect flash before the group hides. */
  const flashing = useRef<Map<number, number>>(new Map());
  const camera = useThree((s) => s.camera);

  // A world reset swaps the `powerups` array identity; clear the collected set so a new
  // power-up reusing an old index isn't immediately hidden as already-taken.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset keyed on array identity
  useEffect(() => {
    collected.current.clear();
    flashing.current.clear();
  }, [powerups]);

  useFrame((state, delta) => {
    const g = groupRef.current;
    if (!g) return;
    const [bx, by, bz] = getBlobDiagnostics().position;
    const t = state.clock.elapsedTime;
    const dt = Math.min(delta, 1 / 30);

    g.children.forEach((child, i) => {
      const p = powerups[i];
      if (!p) return;
      // Aura is the FIRST child (a plain mesh that mounts synchronously, so its index is
      // stable); the model is the Suspense-wrapped subtree after it (fallback OR GLB — index 1
      // either way). Ordering aura-first avoids the Suspense swap shifting the indices.
      const aura = child.children[0] as Mesh | undefined;
      const auraMat = aura?.material as MeshBasicMaterial | undefined;
      const model = child.children[1];

      // Collect flash: a quick bright aura bloom + the model hides, then the whole group goes.
      const flashAge = flashing.current.get(i);
      if (flashAge !== undefined) {
        const na = flashAge + dt;
        if (na >= FLASH_LIFE) {
          flashing.current.delete(i);
          child.visible = false;
          return;
        }
        flashing.current.set(i, na);
        const f = na / FLASH_LIFE;
        if (model) model.visible = false;
        if (aura && auraMat) {
          aura.visible = true;
          aura.lookAt(camera.position);
          const s = 1 + 3 * f;
          aura.scale.set(s, s, s);
          auraMat.opacity = (1 - f) * 0.9;
        }
        return;
      }
      if (collected.current.has(i)) {
        child.visible = false;
        return;
      }

      child.position.set(
        p.position[0],
        p.position[1] + Math.sin(t * 2.5 + i) * 0.25,
        p.position[2],
      );
      if (model) model.rotation.y = t * 2 + i;

      // Attract AURA: a billboarded additive halo behind the model that pulses, and brightens
      // + grows as the blob nears — drawing the eye toward a pickup. Billboard so it always
      // faces the camera.
      const dx = p.position[0] - bx;
      const dy = p.position[1] - by;
      const dz = p.position[2] - bz;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (aura && auraMat) {
        aura.visible = true;
        aura.lookAt(camera.position);
        const near = Math.max(0, 1 - d2 / (14 * 14)); // 0 far → 1 close (within ~14u)
        const pulse = 0.5 + 0.5 * Math.sin(t * 3 + i);
        const s = 1.1 + 0.25 * pulse + 0.7 * near;
        aura.scale.set(s, s, s);
        auraMat.opacity = 0.18 + 0.22 * pulse + 0.4 * near;
      }

      if (d2 <= PICKUP_R2) {
        collected.current.add(i);
        flashing.current.set(i, 0); // start the collect flash
        activatePowerup(p.type);
        playPowerup();
      }
    });
  });

  return (
    <group ref={groupRef}>
      {powerups.map((p, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: append-only world list
        <group key={i}>
          {/* Aura FIRST (synchronous mount → stable child index 0) so the Suspense model swap
              below can't shift the model/aura indices the frame loop relies on. */}
          <mesh visible={false}>
            <circleGeometry args={[0.9, 32]} />
            <meshBasicMaterial
              color={AURA_COLOR[p.type]}
              transparent
              opacity={0}
              blending={AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
          {/* GLB model (3DLowPoly) with the primitive as the Suspense fallback so the
              powerup never blanks while the model streams in. */}
          <Suspense fallback={<PrimitivePowerup type={p.type} />}>
            <PowerUpModel type={p.type} />
          </Suspense>
        </group>
      ))}
    </group>
  );
}

/** Primitive fallback (cone/torus) shown until the GLB model loads. */
function PrimitivePowerup({ type }: { type: PowerUpType }) {
  if (type === "magnet") {
    return (
      <mesh>
        <torusGeometry args={[0.45, 0.16, 10, 24]} />
        <meshStandardMaterial
          color={palette.tramp.blue}
          emissive={palette.tramp.blue}
          emissiveIntensity={0.7}
          roughness={0.2}
        />
      </mesh>
    );
  }
  if (type === "shield") {
    // A glowing protective orb (icy/cyan) — the one-shot second-life pickup.
    return (
      <mesh>
        <icosahedronGeometry args={[0.45, 1]} />
        <meshStandardMaterial
          color={palette.tramp.ice}
          emissive={palette.tramp.ice}
          emissiveIntensity={0.6}
          roughness={0.15}
          metalness={0.3}
          transparent
          opacity={0.85}
        />
      </mesh>
    );
  }
  return (
    <mesh rotation={[Math.PI, 0, 0]}>
      <coneGeometry args={[0.4, 0.9, 16]} />
      <meshStandardMaterial
        color={palette.tramp.orange}
        emissive={palette.tramp.orange}
        emissiveIntensity={0.7}
        roughness={0.2}
      />
    </mesh>
  );
}
