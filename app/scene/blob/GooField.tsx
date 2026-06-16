import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import type { Color, Group, Mesh, ShaderMaterial, Vector3 } from "three";
import type { BlobSkin } from "@/core/types";
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

    // Eyes ride on the goo front: sit at the blob center, nudged toward the camera on
    // the horizontal plane, and yaw to face the camera while staying upright (so they
    // never tilt off the face when the camera looks down).
    const eyes = eyesRef.current;
    if (eyes) {
      const dx = camera.position.x - bx;
      const dz = camera.position.z - bz;
      const len = Math.hypot(dx, dz) || 1;
      const push = blobRadius * 0.7;
      eyes.position.set(bx + (dx / len) * push, by + blobRadius * 0.12, bz + (dz / len) * push);
      eyes.rotation.set(0, Math.atan2(dx, dz), 0);
    }

    // Mutate the uniform arrays in place (drei holds them by reference; no allocs).
    const balls = material.uniforms.u_balls.value as Vector3[];
    const radii = material.uniforms.u_radii.value as Float32Array;

    // Ball 0 = the blob body, at the hull origin (which is the blob).
    balls[0].set(0, 0, 0);
    radii[0] = blobRadius;
    let count = 1;

    const droplets = getDroplets();
    for (let i = 0; i < droplets.length && count < MAX_GOO_BALLS; i++) {
      const d = droplets[i];
      // Only merge droplets near the blob; distant ones render as free particles.
      const dx = d.position[0] - bx;
      const dy = d.position[1] - by;
      const dz = d.position[2] - bz;
      if (dx * dx + dy * dy + dz * dz < 9) {
        balls[count].set(dx, dy, dz);
        radii[count] = d.radius;
        count++;
      }
    }

    material.uniforms.u_count.value = count;
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
