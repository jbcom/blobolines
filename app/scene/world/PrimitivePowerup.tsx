import type { ReactElement } from "react";
import type { PowerUpType } from "@/core/types";
import { palette } from "@/styles/tokens";

/**
 * Primitive power-up shape (torus/cone/orb/gem). Doubles as the Suspense fallback while a
 * GLB streams in AND as the FINAL look for model-less types (shield, slow-mo, score-doubler,
 * multi-bounce) — one source of truth, so the fallback and the settled model can never
 * diverge. Lives in its own module so both PowerUpModel and PowerUpField can import it without
 * a circular dependency.
 *
 * Table-driven (mirrors PowerUpModel's MODEL table): each type's distinct geometry + material
 * tuning lives in one readable row, so the per-type look is a glance, not six copy-pasted
 * meshes. The fixtures assert on rendered pixels (not JSX element types), so this is purely a
 * structural dedupe.
 */
interface PrimitiveSpec {
  /** The geometry element for this power-up's silhouette. */
  geometry: ReactElement;
  color: string;
  emissiveIntensity: number;
  roughness: number;
  metalness?: number;
  transparent?: boolean;
  opacity?: number;
  /** Extra mesh rotation (the thruster cone points down). */
  rotation?: [number, number, number];
}

const SHAPE: Record<PowerUpType, PrimitiveSpec> = {
  magnet: {
    geometry: <torusGeometry args={[0.45, 0.16, 10, 24]} />,
    color: palette.tramp.blue,
    emissiveIntensity: 0.7,
    roughness: 0.2,
  },
  thruster: {
    // The rocket cone points down off the pad.
    geometry: <coneGeometry args={[0.4, 0.9, 16]} />,
    color: palette.tramp.orange,
    emissiveIntensity: 0.7,
    roughness: 0.2,
    rotation: [Math.PI, 0, 0],
  },
  shield: {
    // A glowing protective orb (icy/cyan) — the one-shot second-life pickup.
    geometry: <icosahedronGeometry args={[0.45, 1]} />,
    color: palette.tramp.ice,
    emissiveIntensity: 0.6,
    roughness: 0.15,
    metalness: 0.3,
    transparent: true,
    opacity: 0.85,
  },
  slowmo: {
    // A violet "time crystal" gem (octahedron) — the bullet-time pickup.
    geometry: <octahedronGeometry args={[0.5, 0]} />,
    color: palette.tramp.violet,
    emissiveIntensity: 0.7,
    roughness: 0.1,
    metalness: 0.4,
    transparent: true,
    opacity: 0.9,
  },
  doubler: {
    // A gold dodecahedron "value gem" — the score-doubler pickup (gold reads as score/value).
    geometry: <dodecahedronGeometry args={[0.46, 0]} />,
    color: palette.tramp.gold,
    emissiveIntensity: 0.7,
    roughness: 0.12,
    metalness: 0.5,
  },
  multibounce: {
    // A green springy tetrahedron — the multi-bounce charges (green reads as bouncy slime).
    geometry: <tetrahedronGeometry args={[0.55, 0]} />,
    color: palette.tramp.green,
    emissiveIntensity: 0.7,
    roughness: 0.2,
    metalness: 0.2,
  },
};

export function PrimitivePowerup({ type }: { type: PowerUpType }) {
  const { geometry, color, rotation, ...mat } = SHAPE[type];
  return (
    <mesh rotation={rotation}>
      {geometry}
      <meshStandardMaterial color={color} emissive={color} {...mat} />
    </mesh>
  );
}
