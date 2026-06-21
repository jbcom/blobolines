import { useFrame } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import type { InstancedMesh } from "three";
import { AdditiveBlending, Color, DoubleSide, Matrix4, Quaternion, Vector3 } from "three";
import { playChime, playMilestone } from "@/audio";
import { world as worldCfg } from "@/config";
import type { CrystalTier } from "@/core/types";
import { NotificationType, notify } from "@/platform";
import { BLOOM_THRESHOLD } from "@/render/bloom";
import { stepCrystal } from "@/sim/collect";
import {
  flash,
  getBlobDiagnostics,
  isPowerupActive,
  markCrystalCollected,
  resetCollectedCrystals,
  scoreMultiplier,
  useGameStore,
  useWorldStore,
} from "@/state";
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
const UP = new Vector3(0, 1, 0);
const MAX_CRYSTALS = worldCfg.maxCrystals;
/** HDR multiplier on the twinkle glint so a gem's sparkle peak clears the bloom threshold (the gems
 *  are bloom targets — see bloom.ts). Sized off BLOOM_THRESHOLD so it tracks the threshold; the
 *  dimmest tier color (~0.3 luminance) still peaks above it at the glint maximum. */
const CRYSTAL_GLOW = BLOOM_THRESHOLD * 2.6;
const POP_LIFE = 0.22; // seconds the collect-burst pop plays before the gem vanishes
// Per-tier gem color: common reads as berry, rare as a bright jewel, radiant as a hot gold
// prize — so rarity is legible at a glance (and matches the bigger tier scale).
const TIER_COLOR: Record<CrystalTier, Color> = {
  common: new Color(hex(palette.blob.slime)),
  rare: new Color(hex(palette.tramp.violet)),
  radiant: new Color(hex(palette.tramp.gold)),
  // Treasure: the brightest, warmest gold — it's the jackpot. (The chest GLB renders separately;
  // this color drives its instanced halo + collect-burst flash so it reads as the richest tier.)
  treasure: new Color(hex(palette.sun)),
};

export function CrystalField() {
  const meshRef = useRef<InstancedMesh>(null);
  const haloRef = useRef<InstancedMesh>(null);
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
    resetCollectedCrystals(); // clear the shared set TreasureChests reads
    popping.current.clear();
  }, [crystals]);

  useFrame((state, delta) => {
    const mesh = meshRef.current;
    const halo = haloRef.current;
    if (!mesh || !halo) return;

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
    let treasureHit = false; // set when a treasure-tier gem is collected this frame
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
        tmpQuat.copy(state.camera.quaternion);
        tmpScale.setScalar(pop * 1.45);
        tmpMat.compose(tmpObj, tmpQuat, tmpScale);
        halo.setMatrixAt(visible, tmpMat);
        halo.setColorAt(visible, tmpColor);
        visible++;
        continue;
      }
      if (collected.current.has(i)) continue;
      // Magnet-pull (if active) + pickup test in one pure step — keeps the magnetStep arg
      // order correct at the integration boundary (it was previously swapped here).
      if (stepCrystal(blobPos, pos[i], dt, magnet)) {
        collected.current.add(i);
        markCrystalCollected(i); // shared so TreasureChests drops a collected treasure's chest
        popping.current.set(i, 0); // start the collect burst
        gathered += CRYSTAL_VALUE[tier[i]];
        if (tier[i] === "treasure") treasureHit = true; // jackpot — celebrate this frame
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
      // Twinkle glint: a per-gem brightness pulse (phase-offset by id) with a sharp bright flash at
      // the peak — a sparkle, not a smooth fade. Multiplies the tier color. The material is
      // toneMapped={false}, and the scalar is pushed into HDR (×CRYSTAL_GLOW so peaks exceed the
      // BLOOM_THRESHOLD in the linear buffer the bloom pass reads) so the gem reads as a GLOWING
      // bloom target — a sparkle glint — not a flatly-lit shape that the high bloom threshold ignores.
      const tw = Math.sin(t * 3.2 + i * 1.7);
      // A steady base (0.55) so the gem NEVER winks fully black at the sine trough — the old
      // 0.85+0.35·tw curve bottomed at exactly 0 at tw=-1 — plus a soft pulse and a sharp sparkle
      // spike on the UPSWING only (tw**8 on positive tw). The base alone keeps the gem visibly lit;
      // the spike is the moment it crosses into bloom.
      const up = Math.max(0, tw);
      const glint = (0.55 + 0.25 * tw + 0.5 * up ** 8) * CRYSTAL_GLOW;
      tmpColor.copy(TIER_COLOR[tier[i]]).multiplyScalar(glint);
      mesh.setColorAt(visible, tmpColor);
      tmpQuat.copy(state.camera.quaternion);
      tmpScale.setScalar(s * (1.05 + Math.max(0, tw) * 0.16));
      tmpMat.compose(tmpObj, tmpQuat, tmpScale);
      halo.setMatrixAt(visible, tmpMat);
      halo.setColorAt(visible, tmpColor);
      visible++;
    }
    mesh.count = visible;
    halo.count = visible;
    mesh.instanceMatrix.needsUpdate = true;
    halo.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    if (halo.instanceColor) halo.instanceColor.needsUpdate = true;

    if (gathered > 0) {
      // Score-doubler: each gem collected while the buff is active is worth double (rounded so
      // the crystal total stays an integer). scoreMultiplier() is 1 when inactive.
      addCrystals(Math.round(gathered * scoreMultiplier()));
      // A treasure-tier pickup is the jackpot — a celebratory gold flash + milestone stinger over
      // the usual collect chime. Otherwise the normal gather chime.
      if (treasureHit) {
        flash("gold", 0.9);
        playMilestone();
        // Tactile reward for the jackpot, mirroring the combo/perfect-release celebration haptics.
        if (useGameStore.getState().settings.haptics) void notify(NotificationType.Success);
      } else {
        playChime();
      }
    }
  });

  return (
    <group>
      <instancedMesh
        ref={haloRef}
        args={[undefined, undefined, MAX_CRYSTALS]}
        frustumCulled={false}
        renderOrder={21}
      >
        <ringGeometry args={[0.56, 0.86, 40]} />
        <meshBasicMaterial
          color={hex(palette.goo.wet)}
          transparent
          opacity={0.34}
          depthWrite={false}
          depthTest={false}
          side={DoubleSide}
          blending={AdditiveBlending}
          toneMapped={false}
        />
      </instancedMesh>
      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, MAX_CRYSTALS]}
        frustumCulled={false}
        renderOrder={22}
      >
        <octahedronGeometry args={[0.45, 0]} />
        {/* Per-instance setColorAt tints these gems; the color we write each frame carries a
            TWINKLE (a brightness pulse, phase-offset per gem) baked in. toneMapped off so the
            bright pulse peaks read as a sparkle glint instead of being tonemapped flat. */}
        <meshStandardMaterial
          color={hex(palette.goo.wet)}
          roughness={0.15}
          metalness={0.4}
          toneMapped={false}
        />
      </instancedMesh>
    </group>
  );
}
