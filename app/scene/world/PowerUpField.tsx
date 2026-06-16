import { useFrame } from "@react-three/fiber";
import { Suspense, useEffect, useRef } from "react";
import type { Group } from "three";
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

export function PowerUpField() {
  const groupRef = useRef<Group>(null);
  const powerups = useWorldStore((s) => s.powerups);
  const collected = useRef<Set<number>>(new Set());

  // A world reset swaps the `powerups` array identity; clear the collected set so a new
  // power-up reusing an old index isn't immediately hidden as already-taken.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset keyed on array identity
  useEffect(() => {
    collected.current.clear();
  }, [powerups]);

  useFrame((state) => {
    const g = groupRef.current;
    if (!g) return;
    const [bx, by, bz] = getBlobDiagnostics().position;
    const t = state.clock.elapsedTime;

    g.children.forEach((child, i) => {
      if (collected.current.has(i)) {
        child.visible = false;
        return;
      }
      const p = powerups[i];
      if (!p) return;
      child.position.set(
        p.position[0],
        p.position[1] + Math.sin(t * 2.5 + i) * 0.25,
        p.position[2],
      );
      child.rotation.y = t * 2 + i;
      const dx = p.position[0] - bx;
      const dy = p.position[1] - by;
      const dz = p.position[2] - bz;
      if (dx * dx + dy * dy + dz * dz <= PICKUP_R2) {
        collected.current.add(i);
        child.visible = false;
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
