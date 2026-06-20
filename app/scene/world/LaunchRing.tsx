import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import {
  AdditiveBlending,
  Color,
  type Group,
  type Mesh,
  type MeshBasicMaterial,
  RingGeometry,
} from "three";
import { consumeLaunchBursts, type GroundRingKind } from "@/state";
import { hex, palette } from "@/styles/tokens";

/**
 * LaunchRing — expanding, fading flat rings that bloom at the pad on launch + landing (the
 * in-world "pop"; the screen flash is the DOM side, this is the 3D side). A small pool of ring
 * meshes is cycled — each event grabs the next slot, snaps it to the pad, recolors by kind
 * (launch = blue bloom, land = gold impact), and animates it outward + transparent over
 * ~0.45s. Driven imperatively off the ring-burst bridge; no per-frame React re-render.
 * Additive-blended so it reads as light.
 */

const POOL = 6;
// Stable React keys for the fixed, never-reordered mesh pool (index-as-key lint guard).
const RING_KEYS = Array.from({ length: POOL }, (_, i) => `launch-ring-${i}`);
const LIFE = 0.45; // seconds for a ring to expand + fade out
const BASE_RADIUS = 0.9; // ring start radius at charge 0
const MAX_GROW = 5.5; // extra radius a full-charge ring expands to
const KIND_COLOR: Record<GroundRingKind, Color> = {
  launch: new Color(hex(palette.blob.blue)),
  land: new Color(hex(palette.tramp.gold)),
  nudge: new Color(hex(palette.cloud.bubble)),
};

interface RingSlot {
  age: number; // >= LIFE means idle
  charge: number;
}

export function LaunchRing() {
  const groupRef = useRef<Group>(null);
  const slots = useRef<RingSlot[]>(Array.from({ length: POOL }, () => ({ age: LIFE, charge: 0 })));
  const next = useRef(0);

  // One flat ring geometry (XZ plane) shared by every pooled mesh; scaled per-frame.
  const geo = useMemo(() => {
    const g = new RingGeometry(0.62, 1, 40);
    g.rotateX(-Math.PI / 2); // lie flat on the pad
    return g;
  }, []);

  useFrame((_, dt) => {
    const group = groupRef.current;
    if (!group) return;

    // Start any newly reported bursts on the next free-cycled slot, recoloring by kind.
    for (const ev of consumeLaunchBursts()) {
      const i = next.current;
      next.current = (next.current + 1) % POOL;
      slots.current[i] = { age: 0, charge: Math.max(0, Math.min(1, ev.charge)) };
      const m = group.children[i] as Mesh;
      m.position.set(ev.position[0], ev.position[1] + 0.05, ev.position[2]);
      (m.material as MeshBasicMaterial).color.copy(KIND_COLOR[ev.kind]);
    }

    // Animate each live ring: grow outward + fade. Hidden when idle.
    for (let i = 0; i < POOL; i++) {
      const s = slots.current[i];
      const m = group.children[i] as Mesh;
      const mat = m.material as MeshBasicMaterial;
      if (s.age >= LIFE) {
        m.visible = false;
        continue;
      }
      s.age += dt;
      const t = Math.min(1, s.age / LIFE);
      m.visible = true;
      // Ease-out expansion (fast then settling); bigger charge → bigger ring.
      const grow = 1 - (1 - t) * (1 - t);
      const r = BASE_RADIUS + grow * (MAX_GROW * (0.4 + 0.6 * s.charge));
      m.scale.set(r, 1, r);
      mat.opacity = (1 - t) * (0.5 + 0.4 * s.charge);
    }
  });

  return (
    <group ref={groupRef}>
      {RING_KEYS.map((key) => (
        <mesh key={key} geometry={geo} visible={false} frustumCulled={false}>
          <meshBasicMaterial
            color={hex(palette.blob.blue)}
            transparent
            opacity={0}
            blending={AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}
