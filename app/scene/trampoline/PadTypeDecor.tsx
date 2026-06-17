import { useMemo } from "react";
import type { TrampType } from "@/core/types";
import { hex, palette, trampColor } from "@/styles/tokens";

/**
 * PadTypeDecor — per-type silhouette cues on top of the membrane so a pad's KIND reads at a
 * glance (not only by color): super gets a glowing wireframe frame (a treasure pad), booster
 * upward chevrons (flings you higher), ice a frosty translucent slab, fragile crack lines,
 * wobbler an off-kilter ring (unstable), canted a directional arrow toward its tilt. Cheap
 * line/flat geometry; purely decorative (no physics). Geometry is R3F-managed (JSX
 * bufferGeometry) so its lifecycle/disposal is handled even under Strict-Mode double-mount.
 */
interface PadTypeDecorProps {
  type: TrampType;
  width: number;
  depth: number;
  /** Lateral cant direction for "canted" pads, to aim the arrow. */
  cant?: readonly [number, number];
  /** Lateral slide direction for "moving" pads, to aim the rail cue. */
  moveAxis?: readonly [number, number];
}

const TOP = 0.16; // just above the membrane top

export function PadTypeDecor({ type, width, depth, cant, moveAxis }: PadTypeDecorProps) {
  const color = hex(trampColor[type] ?? palette.tramp.gold);

  // Line-segment ENDPOINTS (not a geometry object) built once per (type, size) — pads don't
  // resize after spawn. Rendered via a JSX <bufferGeometry> below so R3F owns its lifecycle +
  // disposal (Strict-Mode-safe, unlike a useMemo'd geometry disposed by hand).
  const positions = useMemo(() => {
    if (type === "fragile") {
      // Crack lines radiating from center.
      const r = Math.min(width, depth) * 0.42;
      const pts: number[] = [];
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + 0.4;
        pts.push(0, TOP, 0, Math.cos(a) * r, TOP, Math.sin(a) * r);
      }
      return new Float32Array(pts);
    }
    if (type === "booster") {
      // Two stacked upward chevrons pointing +Z (toward the back; reads as "up" in the tilt).
      const w = width * 0.34;
      const pts: number[] = [];
      for (const oz of [-depth * 0.12, depth * 0.08]) {
        pts.push(-w, TOP, oz, 0, TOP, oz + w, 0, TOP, oz + w, w, TOP, oz);
      }
      return new Float32Array(pts);
    }
    return null;
  }, [type, width, depth]);

  if (positions) {
    return (
      <lineSegments>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        </bufferGeometry>
        <lineBasicMaterial color={color} transparent opacity={0.9} />
      </lineSegments>
    );
  }

  if (type === "moving") {
    const [x, z] = moveAxis ?? [1, 0];
    const angle = Math.atan2(z, x);
    const length = Math.min(width, depth) * 0.7;
    const gap = Math.min(width, depth) * 0.12;
    return (
      <group position={[0, TOP, 0]} rotation={[0, -angle, 0]}>
        <mesh position={[0, 0, -gap]}>
          <boxGeometry args={[length, 0.055, 0.07]} />
          <meshBasicMaterial color={color} transparent opacity={0.9} />
        </mesh>
        <mesh position={[0, 0, gap]}>
          <boxGeometry args={[length, 0.055, 0.07]} />
          <meshBasicMaterial color={color} transparent opacity={0.9} />
        </mesh>
        <mesh position={[length * 0.32, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
          <coneGeometry args={[0.18, 0.42, 3]} />
          <meshBasicMaterial color={color} transparent opacity={0.8} />
        </mesh>
      </group>
    );
  }

  if (type === "super") {
    return (
      <mesh position={[0, TOP, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[Math.min(width, depth) * 0.36, 0.045, 8, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.9} />
      </mesh>
    );
  }

  if (type === "ice") {
    // A frosty translucent round film over the membrane — slippery, see-through.
    return (
      <mesh position={[0, TOP, 0]}>
        <cylinderGeometry
          args={[Math.min(width, depth) * 0.34, Math.min(width, depth) * 0.36, 0.06, 40]}
        />
        <meshPhysicalMaterial
          color={hex(palette.tramp.blue)}
          transmission={0.6}
          thickness={0.4}
          roughness={0.05}
          transparent
          opacity={0.5}
        />
      </mesh>
    );
  }

  if (type === "wobbler") {
    // An off-kilter ring — visibly unstable.
    return (
      <mesh position={[0, TOP, 0]} rotation={[-Math.PI / 2 + 0.25, 0, 0.2]}>
        <torusGeometry args={[Math.min(width, depth) * 0.34, 0.04, 8, 24]} />
        <meshBasicMaterial color={color} transparent opacity={0.8} />
      </mesh>
    );
  }

  if (type === "canted" && cant) {
    // An arrow (cone) pointing the way the cant throws the bounce.
    const angle = Math.atan2(cant[1], cant[0]);
    return (
      <group position={[0, TOP, 0]} rotation={[0, -angle, 0]}>
        <mesh position={[width * 0.22, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
          <coneGeometry args={[0.26, 0.6, 4]} />
          <meshBasicMaterial color={color} transparent opacity={0.85} />
        </mesh>
      </group>
    );
  }

  return null;
}
