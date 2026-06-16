import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import type { Color, Group, Mesh, ShaderMaterial, Vector3 } from "three";
import type { BlobSkin } from "@/core/types";
import { packMetaballField } from "@/render/goo";
import { MAX_GOO_BALLS, MetaballGooMaterial } from "@/render/materials";
import type { Droplet } from "@/render/vfx";
import { getBlobDiagnostics } from "@/state";
import { palette } from "@/styles/tokens";
import { BlobEyes } from "./BlobEyes";

/**
 * GooField — the merging goo skin. A hull mesh centered on the blob renders a raymarched
 * metaball isosurface (MetaballGooMaterial) whose point sources are the blob body plus
 * the live splash droplets near it, so droplets visibly stretch into and pinch off the
 * blob. Driven imperatively each frame from the diagnostics bridge + the droplets ref —
 * no per-frame React render. The hull is recentred on the blob so MAX_DIST stays local.
 *
 * `getDroplets` returns the current active droplets (managed by the splash system).
 */
interface GooFieldProps {
  skin: BlobSkin;
  blobRadius: number;
  getDroplets: () => readonly Droplet[];
}

export function GooField({ skin, blobRadius, getDroplets }: GooFieldProps) {
  const hullRef = useRef<Mesh>(null);
  const eyesRef = useRef<Group>(null);
  const camera = useThree((s) => s.camera);
  const material = useMemo(() => new MetaballGooMaterial() as unknown as ShaderMaterial, []);

  useFrame((state) => {
    const hull = hullRef.current;
    if (!hull) return;
    const [bx, by, bz] = getBlobDiagnostics().position;

    // Hull follows the blob so the raymarch stays in a small local volume.
    hull.position.set(bx, by, bz);

    // Eyes anchor at the blob's world center and face the camera; BlobEyes' own small
    // forward z-offset lifts the eyeballs onto the goo face. (The goo metaball now renders
    // at this same world center — see the u_balls world-space fix below — so the eyes sit
    // on the face instead of floating where the body should be.)
    const eyes = eyesRef.current;
    if (eyes) {
      eyes.position.set(bx, by, bz);
      eyes.lookAt(camera.position);
    }

    // Mutate the uniform arrays in place (drei holds them by reference; no allocs).
    const balls = material.uniforms.u_balls.value as Vector3[];
    const radii = material.uniforms.u_radii.value as Float32Array;

    // The fragment shader raymarches in WORLD space (ro = vWorldPos, the hull's world
    // surface), so the metaball centers MUST be world-space too — packMetaballField keeps
    // them world-space. (Packing blob-local offsets while the march is world-space pinned
    // the whole field to world origin: the goo rendered on the floor and the eyes, placed
    // at the blob, floated above it.)
    const field = packMetaballField([bx, by, bz], blobRadius, getDroplets(), MAX_GOO_BALLS);
    for (let i = 0; i < field.count; i++) {
      balls[i].set(field.centers[i][0], field.centers[i][1], field.centers[i][2]);
      radii[i] = field.radii[i];
    }

    material.uniforms.u_count.value = field.count;
    material.uniforms.u_time.value = state.clock.elapsedTime;
    (material.uniforms.u_color.value as Color).set(palette.blob[skin]);
    (material.uniforms.u_rim.value as Color).set(palette.goo.rim);
  });

  return (
    <>
      <mesh ref={hullRef} material={material}>
        {/* Hull contains the blob + near droplets; the raymarch happens within it. */}
        <sphereGeometry args={[blobRadius + 3, 16, 16]} />
      </mesh>
      {/* Eyes billboarded onto the goo front (world space, bridge-driven). */}
      <group ref={eyesRef} renderOrder={2}>
        <BlobEyes expression="idle" radius={blobRadius} live />
      </group>
    </>
  );
}
