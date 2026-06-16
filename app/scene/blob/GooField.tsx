import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import type { Color, Mesh, ShaderMaterial, Vector3 } from "three";
import type { BlobSkin } from "@/core/types";
import { MAX_GOO_BALLS, MetaballGooMaterial } from "@/render/materials";
import type { Droplet } from "@/render/vfx";
import { getBlobDiagnostics } from "@/state";
import { palette } from "@/styles/tokens";

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
  const material = useMemo(() => new MetaballGooMaterial() as unknown as ShaderMaterial, []);

  useFrame((state) => {
    const hull = hullRef.current;
    if (!hull) return;
    const [bx, by, bz] = getBlobDiagnostics().position;

    // Hull follows the blob so the raymarch stays in a small local volume.
    hull.position.set(bx, by, bz);

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
    <mesh ref={hullRef} material={material}>
      {/* Hull large enough to contain the blob + near droplets; raymarch happens within. */}
      <sphereGeometry args={[blobRadius + 3, 16, 16]} />
    </mesh>
  );
}
