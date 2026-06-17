import { useFrame } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import type { InstancedMesh } from "three";
import { Color, Matrix4, Quaternion, Vector3 } from "three";
import { playChime } from "@/audio";
import { world as worldCfg } from "@/config";
import type { CrystalTier } from "@/core/types";
import { stepCrystal } from "@/sim/collect";
import { getBlobDiagnostics, isPowerupActive, useGameStore, useWorldStore } from "@/state";
import { hex, palette } from "@/styles/tokens";
import { CRYSTAL_SCALE, CRYSTAL_VALUE } from "@/world";

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
const tmpColor = new Color();
const MAX_CRYSTALS = worldCfg.maxCrystals;
const POP_LIFE = 0.22; // seconds the collect-burst pop plays before the gem vanishes
// Per-tier gem color: common reads as the slime-green pickup, rare as a violet jewel, radiant
// as a hot gold prize — so rarity is legible at a glance (and matches the bigger tier scale).
const TIER_COLOR: Record<CrystalTier, Color> = {
  common: new Color(hex(palette.blob.slime)),
  rare: new Color(hex(palette.tramp.violet)),
  radiant: new Color(hex(palette.tramp.gold)),
};

export function CrystalField() {
  const meshRef = useRef<InstancedMesh>(null);
  const crystals = useWorldStore((s) => s.crystals);
  const addCrystals = useGameStore((s) => s.addCrystals);
  const collected = useRef<Set<number>>(new Set());
  // Collect-burst: a gathered gem briefly POPS (scales up + flashes bright) before it vanishes,
  // instead of disappearing instantly. index → seconds-since-collected (cleared past POP_LIFE).
  const popping = useRef<Map<number, number>>(new Map());
  // Live positions (mutated by the magnet) + parallel tiers, seeded from the store specs.
  const positions = useRef<[number, number, number][]>([]);
  const tiers = useRef<CrystalTier[]>([]);

  // A world reset/reseed swaps the `crystals` array identity. These refs persist across
  // renders, so without this they'd keep last run's moved positions + collected set —
  // ghost crystals. Clear them whenever the source list identity changes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset keyed on array identity
  useEffect(() => {
    positions.current = [];
    tiers.current = [];
    collected.current.clear();
    popping.current.clear();
  }, [crystals]);

  useFrame((state, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    // Append-only sync: add position + tier for newly generated crystals as the tower extends,
    // WITHOUT rebuilding the array (rebuilding would discard any in-place magnet moves).
    const pos = positions.current;
    const tier = tiers.current;
    for (let i = pos.length; i < crystals.length && i < MAX_CRYSTALS; i++) {
      const c = crystals[i];
      pos.push([c.position[0], c.position[1], c.position[2]]);
      tier.push(c.tier);
    }

    const blobPos = getBlobDiagnostics().position;
    const t = state.clock.elapsedTime;
    const count = Math.min(pos.length, MAX_CRYSTALS);
    const magnet = isPowerupActive("magnet");
    const dt = Math.min(delta, 1 / 30);

    // Single pass: magnet-pull (if active) + render visible instances + collect touched
    // ones (no per-frame allocations). Gathered VALUE sums each crystal's tier worth.
    let visible = 0;
    let gathered = 0;
    for (let i = 0; i < count; i++) {
      const popAge = popping.current.get(i);
      if (popAge !== undefined) {
        // Collect burst: the gathered gem pops outward + flashes bright, then vanishes.
        const np = popAge + dt;
        if (np >= POP_LIFE) {
          popping.current.delete(i);
          continue; // fully collected → hidden from here on
        }
        popping.current.set(i, np);
        const f = np / POP_LIFE;
        const p = pos[i];
        const pop = CRYSTAL_SCALE[tier[i]] * (1 + 2.2 * f); // expand
        tmpObj.set(p[0], p[1], p[2]);
        tmpQuat.setFromAxisAngle(UP, t * 1.5 + i);
        tmpScale.set(pop, pop, pop);
        tmpMat.compose(tmpObj, tmpQuat, tmpScale);
        mesh.setMatrixAt(visible, tmpMat);
        // Flash bright then fade toward black so it reads as a burst of light dissolving.
        tmpColor.copy(TIER_COLOR[tier[i]]).multiplyScalar((1 - f) * 2.4);
        mesh.setColorAt(visible, tmpColor);
        visible++;
        continue;
      }
      if (collected.current.has(i)) continue;
      // Magnet-pull (if active) + pickup test in one pure step — keeps the magnetStep arg
      // order correct at the integration boundary (it was previously swapped here).
      if (stepCrystal(blobPos, pos[i], dt, magnet)) {
        collected.current.add(i);
        popping.current.set(i, 0); // start the collect burst
        gathered += CRYSTAL_VALUE[tier[i]];
        continue;
      }
      const p = pos[i];
      const bob = Math.sin(t * 2 + i) * 0.2;
      tmpObj.set(p[0], p[1] + bob, p[2]);
      tmpQuat.setFromAxisAngle(UP, t * 1.5 + i);
      // Rarer tiers render larger so a radiant gem visibly stands out as a prize.
      const s = CRYSTAL_SCALE[tier[i]];
      tmpScale.set(s, s, s);
      tmpMat.compose(tmpObj, tmpQuat, tmpScale);
      mesh.setMatrixAt(visible, tmpMat);
      // Twinkle glint: a per-gem brightness pulse (phase-offset by id) with a sharp bright
      // flash at the peak — a sparkle, not a smooth fade. Multiplies the tier color.
      const tw = Math.sin(t * 3.2 + i * 1.7);
      const glint = 0.85 + 0.35 * tw + 0.5 * tw ** 8; // soft pulse + sharp sparkle spike
      tmpColor.copy(TIER_COLOR[tier[i]]).multiplyScalar(glint);
      mesh.setColorAt(visible, tmpColor);
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
      {/* Per-instance setColorAt tints these gems; the color we write each frame carries a
          TWINKLE (a brightness pulse, phase-offset per gem) baked in. toneMapped off so the
          bright pulse peaks read as a sparkle glint instead of being tonemapped flat. */}
      <meshStandardMaterial color="#ffffff" roughness={0.15} metalness={0.4} toneMapped={false} />
    </instancedMesh>
  );
}

const UP = new Vector3(0, 1, 0);
