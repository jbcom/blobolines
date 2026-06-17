import { useFrame, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useRef } from "react";
import { AdditiveBlending, type Group, type Mesh, type MeshBasicMaterial } from "three";
import { playPowerup } from "@/audio";
import type { PowerUpType } from "@/core/types";
import { activatePowerup, getBlobDiagnostics, useWorldStore } from "@/state";
import { palette } from "@/styles/tokens";
import { PowerUpModel } from "./PowerUpModel";
import { PrimitivePowerup } from "./PrimitivePowerup";

/**
 * PowerUpField — renders the generated power-ups (magnet = blue torus, thruster = orange
 * cone), bobs/spins them, and activates the matching power-up when the blob touches one.
 * Power-up positions come from the world store; a local "collected" set hides taken ones.
 */
const PICKUP_R2 = (0.75 + 0.85) * (0.75 + 0.85);

const AURA_COLOR: Record<PowerUpType, string> = {
  magnet: palette.tramp.blue,
  thruster: palette.tramp.orange,
  shield: palette.tramp.ice,
  slowmo: palette.tramp.violet,
  doubler: palette.tramp.gold,
  multibounce: palette.tramp.green,
};
const FLASH_LIFE = 0.3; // seconds the collect flash plays

export function PowerUpField() {
  const groupRef = useRef<Group>(null);
  const powerups = useWorldStore((s) => s.powerups);
  /** index → seconds-since-collected, drives the collect flash before the group hides. A
   *  power-up in this map has been collected; the live-list loop keeps updating it only until
   *  the flash finishes, then drops it — so this map is also the "already taken" guard (an
   *  index in here never re-runs the pickup test, because the flash branch returns first). */
  const flashing = useRef<Map<number, number>>(new Map());
  /** Indices still worth updating each frame (uncollected, or collected-and-still-flashing).
   *  Once a power-up's flash finishes it's permanently hidden and dropped from this list, so
   *  the per-frame loop never re-touches a long run's worth of dead pickups (no Set lookup, no
   *  distance calc for hidden ones). Rebuilt only when the source list changes; entries are
   *  spliced out as they die. */
  const live = useRef<number[]>([]);
  /** How many power-up indices the live list has already absorbed — so the append-only tower
   *  extension only adds the genuinely-new tail each frame. */
  const syncedLen = useRef(0);
  const camera = useThree((s) => s.camera);

  // A world reset swaps the `powerups` array identity; clear the flash map so a new power-up
  // reusing an old index isn't treated as already-taken, and reseed the live-index list to
  // every current power-up.
  useEffect(() => {
    flashing.current.clear();
    live.current = powerups.map((_, i) => i);
    syncedLen.current = powerups.length;
  }, [powerups]);

  useFrame((state, delta) => {
    const g = groupRef.current;
    if (!g) return;
    const [bx, by, bz] = getBlobDiagnostics().position;
    const t = state.clock.elapsedTime;
    const dt = Math.min(delta, 1 / 30);

    // The tower extends mid-run (powerups is append-only), so absorb any indices added since
    // the last sync into the live list — they start life as active pickups.
    const liveList = live.current;
    for (let i = syncedLen.current; i < powerups.length; i++) liveList.push(i);
    syncedLen.current = powerups.length;

    // Iterate ONLY live indices (uncollected, or collected-and-still-flashing). Walk back-to-
    // front so a dead entry can be spliced out in place without shifting unvisited indices.
    for (let k = liveList.length - 1; k >= 0; k--) {
      const i = liveList[k];
      const child = g.children[i];
      const p = powerups[i];
      if (!child || !p) {
        liveList.splice(k, 1);
        continue;
      }
      // Aura is the FIRST child (a plain mesh that mounts synchronously, so its index is
      // stable); the model is the Suspense-wrapped subtree after it (fallback OR GLB — index 1
      // either way). Ordering aura-first avoids the Suspense swap shifting the indices.
      const aura = child.children[0] as Mesh | undefined;
      const auraMat = aura?.material as MeshBasicMaterial | undefined;
      const model = child.children[1];

      // Collect flash: a quick bright aura bloom + the model hides, then the whole group goes
      // and the index is dropped from the live list (never touched again).
      const flashAge = flashing.current.get(i);
      if (flashAge !== undefined) {
        const na = flashAge + dt;
        if (na >= FLASH_LIFE) {
          flashing.current.delete(i);
          child.visible = false;
          liveList.splice(k, 1); // fully dead — stop updating it
          continue;
        }
        flashing.current.set(i, na);
        const f = na / FLASH_LIFE;
        if (model) model.visible = false;
        if (aura && auraMat) {
          aura.visible = true;
          aura.lookAt(camera.position);
          const s = 1 + 3 * f;
          aura.scale.set(s, s, s);
          auraMat.opacity = (1 - f) * 0.9;
        }
        continue;
      }

      child.position.set(
        p.position[0],
        p.position[1] + Math.sin(t * 2.5 + i) * 0.25,
        p.position[2],
      );
      if (model) model.rotation.y = t * 2 + i;

      // Attract AURA: a billboarded additive halo behind the model that pulses, and brightens
      // + grows as the blob nears — drawing the eye toward a pickup. Billboard so it always
      // faces the camera.
      const dx = p.position[0] - bx;
      const dy = p.position[1] - by;
      const dz = p.position[2] - bz;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (aura && auraMat) {
        aura.visible = true;
        aura.lookAt(camera.position);
        const near = Math.max(0, 1 - d2 / (14 * 14)); // 0 far → 1 close (within ~14u)
        const pulse = 0.5 + 0.5 * Math.sin(t * 3 + i);
        const s = 1.1 + 0.25 * pulse + 0.7 * near;
        aura.scale.set(s, s, s);
        auraMat.opacity = 0.18 + 0.22 * pulse + 0.4 * near;
      }

      if (d2 <= PICKUP_R2) {
        flashing.current.set(i, 0); // start the collect flash (stays live until it finishes)
        activatePowerup(p.type);
        playPowerup();
      }
    }
  });

  return (
    <group ref={groupRef}>
      {powerups.map((p, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: append-only world list
        <group key={i}>
          {/* Aura FIRST (synchronous mount → stable child index 0) so the Suspense model swap
              below can't shift the model/aura indices the frame loop relies on. */}
          <mesh visible={false}>
            <circleGeometry args={[0.9, 32]} />
            <meshBasicMaterial
              color={AURA_COLOR[p.type]}
              transparent
              opacity={0}
              blending={AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
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
