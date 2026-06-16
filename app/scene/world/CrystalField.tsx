import { useFrame } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import type { InstancedMesh } from "three";
import { Color, Matrix4, Quaternion, Vector3 } from "three";
import { playChime } from "@/audio";
import { world as worldCfg } from "@/config";
import { stepCrystal } from "@/sim/collect";
import { getBlobDiagnostics, isPowerupActive, useGameStore, useWorldStore } from "@/state";
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
const MAX_CRYSTALS = worldCfg.maxCrystals;
// Gem hue palette for per-crystal color variety (cycled deterministically by id).
const GEM_COLORS = [
  new Color(hex(palette.blob.slime)),
  new Color(hex(palette.blob.blue)),
  new Color(hex(palette.tramp.gold)),
  new Color(hex(palette.tramp.violet)),
  new Color(hex(palette.goo.flame)),
];

export function CrystalField() {
  const meshRef = useRef<InstancedMesh>(null);
  const crystals = useWorldStore((s) => s.crystals);
  const addCrystals = useGameStore((s) => s.addCrystals);
  const collected = useRef<Set<number>>(new Set());
  // Live positions (mutated by the magnet); seeded from the store list.
  const positions = useRef<[number, number, number][]>([]);

  // A world reset/reseed swaps the `crystals` array identity. These refs persist across
  // renders, so without this they'd keep last run's moved positions + collected set —
  // ghost crystals. Clear them whenever the source list identity changes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset keyed on array identity
  useEffect(() => {
    positions.current = [];
    collected.current.clear();
  }, [crystals]);

  useFrame((state, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    // Append-only sync: add positions for newly generated crystals as the tower extends,
    // WITHOUT rebuilding the array (rebuilding would discard any in-place moves).
    const pos = positions.current;
    for (let i = pos.length; i < crystals.length && i < MAX_CRYSTALS; i++) {
      pos.push([crystals[i][0], crystals[i][1], crystals[i][2]]);
    }

    const blobPos = getBlobDiagnostics().position;
    const t = state.clock.elapsedTime;
    const count = Math.min(pos.length, MAX_CRYSTALS);
    const magnet = isPowerupActive("magnet");
    const dt = Math.min(delta, 1 / 30);

    // Single pass: magnet-pull (if active) + render visible instances + collect touched
    // ones (no per-frame allocations).
    let visible = 0;
    let gathered = 0;
    for (let i = 0; i < count; i++) {
      if (collected.current.has(i)) continue;
      // Magnet-pull (if active) + pickup test in one pure step — keeps the magnetStep arg
      // order correct at the integration boundary (it was previously swapped here).
      if (stepCrystal(blobPos, pos[i], dt, magnet)) {
        collected.current.add(i);
        gathered++;
        continue;
      }
      const p = pos[i];
      const bob = Math.sin(t * 2 + i) * 0.2;
      tmpObj.set(p[0], p[1] + bob, p[2]);
      tmpQuat.setFromAxisAngle(UP, t * 1.5 + i);
      tmpMat.compose(tmpObj, tmpQuat, tmpScale);
      mesh.setMatrixAt(visible, tmpMat);
      // Per-crystal color variety (was all-green): cycle gem hues deterministically by id.
      mesh.setColorAt(visible, GEM_COLORS[i % GEM_COLORS.length]);
      visible++;
    }
    mesh.count = visible;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

    if (gathered > 0) {
      addCrystals(gathered);
      playChime();
    }
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, MAX_CRYSTALS]} frustumCulled={false}>
      <octahedronGeometry args={[0.45, 0]} />
      {/* White base so per-instance setColorAt tints true. */}
      <meshStandardMaterial color={palette.goo.wet} roughness={0.2} metalness={0.3} />
    </instancedMesh>
  );
}

const UP = new Vector3(0, 1, 0);
