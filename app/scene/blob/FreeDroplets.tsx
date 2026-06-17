import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import {
  type Color,
  type InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
} from "three";
import type { BlobSkin } from "@/core/types";
import type { Droplet } from "@/render/vfx";
import { BLOB } from "@/sim/physics";
import { getBlobDiagnostics } from "@/state";
import { palette } from "@/styles/tokens";

/**
 * FreeDroplets — renders the flung goo droplets as instanced wet spheres so a hard splash /
 * launch visibly throws goo that ARCS and FALLS, instead of the droplets only existing as
 * invisible metaball-merge candidates. GooCsg unions the few NEAREST droplets into the body;
 * the rest (the ones that have flown away) are shown here too — the ones merged into the body
 * are visually subsumed by the larger CSG mass, so showing all of them looks correct and
 * avoids fragile mirroring of the merge selection. Scaled by each droplet's remaining life so
 * they shrink + dissolve. MeshStandardMaterial (instancing-native) tuned wet/glossy.
 */
const MAX = 40; // matches the droplet pool cap
// Droplets within this distance of the blob center are merged into the CSG body by GooCsg, so
// FreeDroplets skips them (else a sphere pokes through the goo surface). ~1.6× blob radius.
const FREE_DIST2 = (BLOB.radius * 1.6) ** 2;

interface FreeDropletsProps {
  skin: BlobSkin;
  getDroplets: () => readonly Droplet[];
}

const tmpMat = new Matrix4();
const tmpPos = new Vector3();
const tmpQuat = new Quaternion();
const tmpScale = new Vector3();

export function FreeDroplets({ skin, getDroplets }: FreeDropletsProps) {
  const meshRef = useRef<InstancedMesh>(null);
  const material = useMemo(
    () => new MeshStandardMaterial({ roughness: 0.12, metalness: 0.25 }),
    [],
  );
  useEffect(() => () => material.dispose(), [material]);
  useEffect(() => {
    (material.color as Color).set(palette.blob[skin]);
  }, [material, skin]);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const [bx, by, bz] = getBlobDiagnostics().position;
    const drops = getDroplets();
    let n = 0;
    for (let i = 0; i < drops.length && n < MAX; i++) {
      const d = drops[i];
      // Fade/shrink over the droplet's life so it dissolves rather than popping out.
      const lifeLeft = Math.max(0, 1 - d.age / d.life);
      if (lifeLeft <= 0.02) continue;
      // Skip droplets close to the body — those are the ones GooCsg unions into the mesh, so
      // rendering them here too would poke small spheres through the goo surface. Only the
      // genuinely flung (far) droplets show as separate goo.
      const dx = d.position[0] - bx;
      const dy = d.position[1] - by;
      const dz = d.position[2] - bz;
      if (dx * dx + dy * dy + dz * dz < FREE_DIST2) continue;
      const r = d.radius * (0.4 + 0.6 * lifeLeft);
      tmpPos.set(d.position[0], d.position[1], d.position[2]);
      tmpScale.setScalar(r);
      tmpMat.compose(tmpPos, tmpQuat, tmpScale);
      mesh.setMatrixAt(n, tmpMat);
      n++;
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, material, MAX]} frustumCulled={false}>
      <sphereGeometry args={[1, 12, 12]} />
    </instancedMesh>
  );
}
