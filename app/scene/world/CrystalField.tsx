import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { InstancedMesh } from "three";
import { Color, Matrix4, Quaternion, Vector3 } from "three";
import { playChime } from "@/audio";
import { collectedIndices, magnetStep } from "@/sim/collect";
import { getBlobDiagnostics, useGameStore, useWorldStore } from "@/state";
import { hex, palette } from "@/styles/tokens";

/**
 * CrystalField — renders the generated crystals as one InstancedMesh (cheap for many),
 * bobs/spins them, applies magnet attraction toward the blob, and collects those the
 * blob touches (chime + crystal count). Crystal positions live in the world store; a
 * local "collected" set hides gathered ones. Driven imperatively each frame.
 */
const tmpObj = new Vector3();
const tmpQuat = new Quaternion();
const tmpScale = new Vector3(1, 1, 1);
const tmpMat = new Matrix4();
const MAX_CRYSTALS = 512;

export function CrystalField() {
  const meshRef = useRef<InstancedMesh>(null);
  const crystals = useWorldStore((s) => s.crystals);
  const addCrystals = useGameStore((s) => s.addCrystals);
  const collected = useRef<Set<number>>(new Set());
  // Live positions (mutated by the magnet); seeded from the store list.
  const positions = useRef<[number, number, number][]>([]);

  useFrame((state) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    // Sync local positions array length with the store (tower extends as we climb).
    if (positions.current.length !== crystals.length) {
      positions.current = crystals.map((c) => [c[0], c[1], c[2]]);
    }

    const blob = getBlobDiagnostics().position;
    const hasMagnet = false; // magnet power-up wiring lands with power-ups
    const t = state.clock.elapsedTime;
    const count = Math.min(crystals.length, MAX_CRYSTALS);

    let visible = 0;
    for (let i = 0; i < count; i++) {
      if (collected.current.has(i)) continue;
      let pos = positions.current[i];
      if (hasMagnet) {
        pos = [...magnetStep(pos, [blob[0], blob[1], blob[2]], 1 / 60)] as [number, number, number];
        positions.current[i] = pos;
      }
      // Bob + spin per instance.
      const bob = Math.sin(t * 2 + i) * 0.2;
      tmpObj.set(pos[0], pos[1] + bob, pos[2]);
      tmpQuat.setFromAxisAngle(UP, t * 1.5 + i);
      tmpMat.compose(tmpObj, tmpQuat, tmpScale);
      mesh.setMatrixAt(visible, tmpMat);
      visible++;
    }
    mesh.count = visible;
    mesh.instanceMatrix.needsUpdate = true;

    // Collect crystals the blob touches.
    const live: [number, number, number][] = [];
    const liveIdx: number[] = [];
    for (let i = 0; i < count; i++) {
      if (!collected.current.has(i)) {
        live.push(positions.current[i]);
        liveIdx.push(i);
      }
    }
    const hits = collectedIndices([blob[0], blob[1], blob[2]], live);
    if (hits.length > 0) {
      for (const h of hits) collected.current.add(liveIdx[h]);
      addCrystals(hits.length);
      playChime();
    }
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, MAX_CRYSTALS]} frustumCulled={false}>
      <octahedronGeometry args={[0.45, 0]} />
      <meshStandardMaterial
        color={new Color(hex(palette.blob.slime))}
        emissive={new Color(hex(palette.blob.slime))}
        emissiveIntensity={0.6}
        roughness={0.2}
        metalness={0.3}
      />
    </instancedMesh>
  );
}

const UP = new Vector3(0, 1, 0);
