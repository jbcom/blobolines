import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { type InstancedMesh, Matrix4, Quaternion, Vector3 } from "three";
import { createRng } from "@/core/math";
import { getBlobDiagnostics } from "@/state";
import { hex, palette } from "@/styles/tokens";

/**
 * Biome strata decor: soft clouds in the lower/sky bands and twinkling stars high up in
 * space, populating the backdrop so each height band reads as a distinct biome (alongside
 * the SkyDome color transition). Cheap instanced geometry placed in a tall column around
 * the climb; opacity fades each layer in/out by the blob's altitude band so only the
 * relevant strata show. Deterministic placement (seeded) — purely decorative.
 */
const CLOUD_COUNT = 14;
const STAR_COUNT = 60;
const COLUMN = 90; // vertical span of placed decor, recentred on the blob
const tmpPos = new Vector3();
const tmpQuat = new Quaternion();
const tmpScale = new Vector3();
const tmpMat = new Matrix4();

function layerOpacity(height: number, lo: number, hi: number): number {
  // Triangular fade: 0 outside [lo,hi], 1 in the middle.
  if (height <= lo || height >= hi) return 0;
  const mid = (lo + hi) / 2;
  return 1 - Math.abs(height - mid) / (mid - lo);
}

export function BiomeProps() {
  const cloudRef = useRef<InstancedMesh>(null);
  const starRef = useRef<InstancedMesh>(null);

  // Deterministic offsets for each instance (placement within the column).
  const clouds = useMemo(() => {
    const rng = createRng(11);
    return Array.from({ length: CLOUD_COUNT }, () => ({
      x: rng.range(-26, 26),
      z: rng.range(-30, -6),
      yFrac: rng.next(),
      s: rng.range(2.5, 5.5),
      drift: rng.range(0.1, 0.4),
    }));
  }, []);
  const stars = useMemo(() => {
    const rng = createRng(23);
    return Array.from({ length: STAR_COUNT }, () => ({
      x: rng.range(-40, 40),
      z: rng.range(-45, 5),
      yFrac: rng.next(),
      s: rng.range(0.08, 0.22),
      tw: rng.range(0, Math.PI * 2),
    }));
  }, []);

  useFrame((state) => {
    const h = getBlobDiagnostics().position[1];
    const t = state.clock.elapsedTime;

    // Clouds populate the sky bands (~80..520m), fading in over the lower atmosphere.
    const cloud = cloudRef.current;
    if (cloud) {
      const op = layerOpacity(h, 60, 560);
      const m = cloud.material as { opacity: number; visible?: boolean };
      m.opacity = op * 0.7;
      cloud.visible = op > 0.01;
      if (cloud.visible) {
        const base = Math.floor(h / COLUMN) * COLUMN;
        clouds.forEach((c, i) => {
          tmpPos.set(c.x + Math.sin(t * c.drift) * 3, base + c.yFrac * COLUMN, c.z);
          tmpScale.set(c.s, c.s * 0.6, c.s);
          tmpMat.compose(tmpPos, tmpQuat, tmpScale);
          cloud.setMatrixAt(i, tmpMat);
        });
        cloud.instanceMatrix.needsUpdate = true;
      }
    }

    // Stars populate the high/space bands (~700m+), twinkling.
    const star = starRef.current;
    if (star) {
      const op = layerOpacity(h, 650, 3000);
      const m = star.material as { opacity: number; visible?: boolean };
      m.opacity = op;
      star.visible = op > 0.01;
      if (star.visible) {
        const base = Math.floor(h / COLUMN) * COLUMN;
        stars.forEach((s, i) => {
          const tw = 0.6 + 0.4 * Math.sin(t * 2 + s.tw);
          tmpPos.set(s.x, base + s.yFrac * COLUMN, s.z);
          tmpScale.setScalar(s.s * tw);
          tmpMat.compose(tmpPos, tmpQuat, tmpScale);
          star.setMatrixAt(i, tmpMat);
        });
        star.instanceMatrix.needsUpdate = true;
      }
    }
  });

  return (
    <>
      <instancedMesh
        ref={cloudRef}
        args={[undefined, undefined, CLOUD_COUNT]}
        frustumCulled={false}
      >
        <sphereGeometry args={[1, 10, 8]} />
        <meshStandardMaterial
          color={palette.goo.wet}
          transparent
          opacity={0}
          depthWrite={false}
          roughness={1}
        />
      </instancedMesh>
      <instancedMesh ref={starRef} args={[undefined, undefined, STAR_COUNT]} frustumCulled={false}>
        <sphereGeometry args={[1, 6, 6]} />
        <meshBasicMaterial color={hex(palette.cream)} transparent opacity={0} depthWrite={false} />
      </instancedMesh>
    </>
  );
}
