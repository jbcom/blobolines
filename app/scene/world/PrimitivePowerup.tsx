import type { PowerUpType } from "@/core/types";
import { palette } from "@/styles/tokens";

/**
 * Primitive power-up shape (torus/cone/orb/gem). Doubles as the Suspense fallback while a
 * GLB streams in AND as the FINAL look for model-less types (shield, slow-mo) — one source
 * of truth, so the fallback and the settled model can never diverge. Lives in its own module
 * so both PowerUpModel and PowerUpField can import it without a circular dependency.
 */
export function PrimitivePowerup({ type }: { type: PowerUpType }) {
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
  if (type === "slowmo") {
    // A violet "time crystal" gem (octahedron) — the bullet-time pickup.
    return (
      <mesh>
        <octahedronGeometry args={[0.5, 0]} />
        <meshStandardMaterial
          color={palette.tramp.violet}
          emissive={palette.tramp.violet}
          emissiveIntensity={0.7}
          roughness={0.1}
          metalness={0.4}
          transparent
          opacity={0.9}
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
