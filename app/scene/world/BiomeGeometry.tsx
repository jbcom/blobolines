import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { type InstancedMesh, Matrix4, Quaternion, Vector3 } from "three";
import { createRng } from "@/core/math";
import { getBlobDiagnostics } from "@/state";
import { mixHex, palette } from "@/styles/tokens";

/**
 * Biome ENVIRONMENT GEOMETRY — big parallax silhouettes far behind the tower that give each
 * altitude band a distinct landscape (beyond the SkyDome color + the small BiomeProps decor):
 *   - ground band  → rolling hills along the horizon,
 *   - mid bands    → drifting floating islands,
 *   - space band   → satellites / debris.
 * Each layer is one InstancedMesh placed deep in -Z (so it parallaxes slowly and never collides
 * with play), wrapped into a tall column around the blob and altitude-faded so only the relevant
 * band shows. Deterministic placement (seeded), purely decorative — no physics, no per-pad cost.
 */
const HILL_COUNT = 9;
const ISLAND_COUNT = 7;
const SAT_COUNT = 10;
/** Vertical span of placed geometry, recentred on the blob each frame (matches BiomeProps). */
const COLUMN = 220;
/** How far back the parallax layers sit (well behind the −30 play depth). */
const FAR_Z = -70;

const tmpPos = new Vector3();
const tmpQuat = new Quaternion();
const tmpAxis = new Vector3(0, 1, 0);
const tmpScale = new Vector3();
const tmpMat = new Matrix4();

/** Triangular altitude fade: 0 outside [lo,hi], 1 at the midpoint (shared shape with BiomeProps). */
function bandFade(height: number, lo: number, hi: number): number {
  if (height <= lo || height >= hi) return 0;
  const mid = (lo + hi) / 2;
  return 1 - Math.abs(height - mid) / (mid - lo);
}

/** Continuous wrap of an instance's 0..1 home fraction into the column window around the blob. */
function wrapY(yFrac: number, h: number): number {
  const lowEdge = h - COLUMN / 2;
  const off = (((yFrac * COLUMN - lowEdge) % COLUMN) + COLUMN) % COLUMN;
  return lowEdge + off;
}

export function BiomeGeometry() {
  const hillRef = useRef<InstancedMesh>(null);
  const islandRef = useRef<InstancedMesh>(null);
  const satRef = useRef<InstancedMesh>(null);

  const hills = useMemo(() => {
    const rng = createRng(101);
    return Array.from({ length: HILL_COUNT }, () => ({
      x: rng.range(-90, 90),
      z: FAR_Z - rng.range(0, 25),
      yFrac: rng.next(),
      w: rng.range(20, 42),
      hgt: rng.range(8, 20),
    }));
  }, []);
  const islands = useMemo(() => {
    const rng = createRng(202);
    return Array.from({ length: ISLAND_COUNT }, () => ({
      x: rng.range(-70, 70),
      z: FAR_Z + rng.range(-10, 18),
      yFrac: rng.next(),
      s: rng.range(6, 14),
      drift: rng.range(0.15, 0.5) * rng.sign(),
      phase: rng.range(0, Math.PI * 2),
    }));
  }, []);
  const sats = useMemo(() => {
    const rng = createRng(303);
    return Array.from({ length: SAT_COUNT }, () => ({
      x: rng.range(-80, 80),
      z: FAR_Z + rng.range(-15, 20),
      yFrac: rng.next(),
      s: rng.range(1.2, 3.2),
      spin: rng.range(0.2, 0.8) * rng.sign(),
      phase: rng.range(0, Math.PI * 2),
    }));
  }, []);

  useFrame((state) => {
    const h = getBlobDiagnostics().position[1];
    const t = state.clock.elapsedTime;

    // HILLS — ground band horizon (fade out by ~220m). Wide flattened cones along the back.
    const hill = hillRef.current;
    if (hill) {
      const op = bandFade(h, -40, 220);
      const m = hill.material as { opacity: number; visible?: boolean };
      m.opacity = op * 0.8;
      hill.visible = op > 0.01;
      if (hill.visible) {
        hills.forEach((c, i) => {
          tmpPos.set(c.x, wrapY(c.yFrac, h) - 6, c.z);
          tmpQuat.identity();
          tmpScale.set(c.w, c.hgt, c.w);
          tmpMat.compose(tmpPos, tmpQuat, tmpScale);
          hill.setMatrixAt(i, tmpMat);
        });
        hill.instanceMatrix.needsUpdate = true;
      }
    }

    // FLOATING ISLANDS — mid bands (~300..820m), drifting sideways + bobbing.
    const island = islandRef.current;
    if (island) {
      const op = bandFade(h, 280, 860);
      const m = island.material as { opacity: number; visible?: boolean };
      m.opacity = op * 0.85;
      island.visible = op > 0.01;
      if (island.visible) {
        islands.forEach((c, i) => {
          tmpPos.set(
            c.x + Math.sin(t * 0.2 + c.phase) * 3 + t * c.drift,
            wrapY(c.yFrac, h) + Math.sin(t * 0.4 + c.phase) * 1.5,
            c.z,
          );
          tmpQuat.identity();
          tmpScale.set(c.s, c.s * 0.45, c.s);
          tmpMat.compose(tmpPos, tmpQuat, tmpScale);
          island.setMatrixAt(i, tmpMat);
        });
        island.instanceMatrix.needsUpdate = true;
      }
    }

    // SATELLITES / DEBRIS — space band (900m+), slow tumbling.
    const sat = satRef.current;
    if (sat) {
      const op = bandFade(h, 880, 2400);
      const m = sat.material as { opacity: number; visible?: boolean };
      m.opacity = op;
      sat.visible = op > 0.01;
      if (sat.visible) {
        sats.forEach((c, i) => {
          tmpPos.set(c.x, wrapY(c.yFrac, h), c.z);
          tmpQuat.setFromAxisAngle(tmpAxis, t * c.spin + c.phase);
          tmpScale.setScalar(c.s);
          tmpMat.compose(tmpPos, tmpQuat, tmpScale);
          sat.setMatrixAt(i, tmpMat);
        });
        sat.instanceMatrix.needsUpdate = true;
      }
    }
  });

  return (
    <>
      {/* Hills — wide low cones in a warm earthy green, far back along the ground horizon. */}
      <instancedMesh ref={hillRef} args={[undefined, undefined, HILL_COUNT]} frustumCulled={false}>
        <coneGeometry args={[0.5, 1, 7]} />
        <meshStandardMaterial
          color={mixHex(palette.tramp.green, palette.cream, 0.25)}
          transparent
          opacity={0}
          roughness={1}
          depthWrite={false}
        />
      </instancedMesh>
      {/* Floating islands — flattened slime-green discs drifting in the mid sky. */}
      <instancedMesh
        ref={islandRef}
        args={[undefined, undefined, ISLAND_COUNT]}
        frustumCulled={false}
      >
        <icosahedronGeometry args={[0.5, 1]} />
        <meshStandardMaterial
          color={mixHex(palette.blob.slime, palette.cream, 0.3)}
          transparent
          opacity={0}
          roughness={0.9}
          depthWrite={false}
        />
      </instancedMesh>
      {/* Satellites / debris — small metallic boxes tumbling in space. */}
      <instancedMesh ref={satRef} args={[undefined, undefined, SAT_COUNT]} frustumCulled={false}>
        <boxGeometry args={[1, 0.4, 0.6]} />
        <meshStandardMaterial
          color={mixHex(palette.tramp.violet, palette.cream, 0.4)}
          transparent
          opacity={0}
          metalness={0.6}
          roughness={0.4}
          depthWrite={false}
        />
      </instancedMesh>
    </>
  );
}
