import { useEffect, useMemo } from "react";
import { BufferGeometry, Float32BufferAttribute } from "three";
import type { TrampType } from "@/core/types";
import { hex, palette, trampColor } from "@/styles/tokens";

/**
 * PadTypeDecor — per-type silhouette cues on top of the membrane so a pad's KIND reads at a
 * glance (not only by color): super gets a glowing wireframe frame (a treasure pad), booster
 * upward chevrons (flings you higher), ice a frosty translucent slab, fragile crack lines,
 * wobbler an off-kilter ring (unstable), canted a directional arrow toward its tilt. Cheap
 * line/flat geometry built once per pad; purely decorative (no physics).
 */
interface PadTypeDecorProps {
  type: TrampType;
  width: number;
  depth: number;
  /** Lateral cant direction for "canted" pads, to aim the arrow. */
  cant?: readonly [number, number];
}

const TOP = 0.16; // just above the membrane top

/** Build a line-segments BufferGeometry from XZ-plane endpoint pairs (laid flat on the pad). */
function lineGeo(points: number[]): BufferGeometry {
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(points, 3));
  return g;
}

export function PadTypeDecor({ type, width, depth, cant }: PadTypeDecorProps) {
  const color = hex(trampColor[type] ?? palette.tramp.gold);

  // Line geometries are built once per (type, size) — pads don't resize after spawn.
  const geo = useMemo(() => {
    const hw = (width * 0.96) / 2;
    const hd = (depth * 0.96) / 2;
    if (type === "super") {
      // Box outline frame (flat on the pad top).
      return lineGeo([
        -hw,
        TOP,
        -hd,
        hw,
        TOP,
        -hd,
        hw,
        TOP,
        -hd,
        hw,
        TOP,
        hd,
        hw,
        TOP,
        hd,
        -hw,
        TOP,
        hd,
        -hw,
        TOP,
        hd,
        -hw,
        TOP,
        -hd,
      ]);
    }
    if (type === "fragile") {
      // Crack lines radiating from center.
      const r = Math.min(width, depth) * 0.42;
      const pts: number[] = [];
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + 0.4;
        pts.push(0, TOP, 0, Math.cos(a) * r, TOP, Math.sin(a) * r);
      }
      return lineGeo(pts);
    }
    if (type === "booster") {
      // Two stacked upward chevrons pointing +Z (toward the back; reads as "up" in the tilt).
      const w = width * 0.34;
      const pts: number[] = [];
      for (const oz of [-depth * 0.12, depth * 0.08]) {
        pts.push(-w, TOP, oz, 0, TOP, oz + w, 0, TOP, oz + w, w, TOP, oz);
      }
      return lineGeo(pts);
    }
    return null;
  }, [type, width, depth]);

  // Dispose the line geometry when the pad unmounts (the render window remounts pads as it
  // slides; a useMemo'd geometry passed as a prop isn't auto-disposed by R3F).
  useEffect(() => () => geo?.dispose(), [geo]);

  if (geo) {
    return (
      <lineSegments geometry={geo}>
        <lineBasicMaterial color={color} transparent opacity={0.9} />
      </lineSegments>
    );
  }

  if (type === "ice") {
    // A frosty translucent slab over the membrane — slippery, see-through.
    return (
      <mesh position={[0, TOP, 0]}>
        <boxGeometry args={[width * 0.9, 0.06, depth * 0.9]} />
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
