import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import type { Color, Group, Mesh, ShaderMaterial, Vector3 } from "three";
import type { BlobSkin } from "@/core/types";
import { packMetaballField } from "@/render/goo";
import { MAX_GOO_BALLS, MetaballGooMaterial } from "@/render/materials";
import type { Droplet } from "@/render/vfx";
import { combineScale, impactSquash, speedStretch } from "@/sim/blob";
import { getBlobDiagnostics, useGameStore } from "@/state";
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
  /** Surface-tension wobble envelope [0,1] — spikes on impact, decays each frame. */
  const wobble = useRef(0);
  /** Current squash/stretch deform, sprung toward the target each frame. */
  const deform = useRef({ x: 1, y: 1, z: 1 });
  const camera = useThree((s) => s.camera);
  const material = useMemo(() => {
    const m = new MetaballGooMaterial() as unknown as ShaderMaterial;
    // Wet/translucent goo: blend grazing edges over the scene. Keep depthWrite so the
    // body still occludes the eyes/world correctly (the edge alpha is subtle).
    m.transparent = true;
    m.depthWrite = true;
    return m;
  }, []);
  // Hand-built material isn't JSX-declared, so R3F won't auto-dispose it — release the
  // compiled GL program on unmount (gameover→retry remounts GooField) to avoid leaking
  // programs until the mobile driver drops draw calls.
  useEffect(() => () => material.dispose(), [material]);

  useFrame((state, dt) => {
    const hull = hullRef.current;
    if (!hull) return;
    const diag = getBlobDiagnostics();
    const [bx, by, bz] = diag.position;

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

    // Combo flame: a streak of 3+ clean bounces lights the goo, ramping to full heat by
    // ~8 in a row. Read imperatively (combo changes rarely) so GooField never re-renders.
    const combo = useGameStore.getState().run.combo;
    material.uniforms.u_heat.value = Math.min(1, Math.max(0, (combo - 2) / 6));

    // Surface-tension jiggle: recover the impact amount from the squash the bridge writes
    // (squash = 1 - impact*0.3), pump the wobble envelope up on a fresh impact, then let
    // it decay so the goo skin ripples and settles like a water balloon.
    const imp = Math.min(1, Math.max(0, (1 - diag.squash) / 0.3));
    wobble.current = Math.max(wobble.current * Math.exp(-dt / 0.7), imp);
    material.uniforms.u_wobble.value = wobble.current;

    // Squash-and-stretch: stretch along velocity while flying, flatten on impact — the
    // same model as the hero blob, now driven into the in-game goo so it's alive (was a
    // rigid sphere). Spring toward the target so it bounces rather than snaps.
    const [vx, vy, vz] = diag.velocity;
    let target = combineScale(speedStretch(vx, vy, vz), impactSquash(imp));

    // Puddle at rest: when grounded and slow, the goo isn't a hovering ball — it settles
    // into a wide flat happy puddle on the pad. Blend toward a squat shape by how settled
    // it is (slow + not airborne), and form back into a blob as it speeds up / launches.
    const settled = diag.airborne ? 0 : 1 - Math.min(diag.speed / 4, 1);
    if (settled > 0.01) {
      const puddle = { x: 1.55, y: 0.42, z: 1.55 };
      target = {
        x: target.x + (puddle.x - target.x) * settled,
        y: target.y + (puddle.y - target.y) * settled,
        z: target.z + (puddle.z - target.z) * settled,
      };
    }
    const sk = 1 - Math.exp(-dt / 0.06);
    deform.current.x += (target.x - deform.current.x) * sk;
    deform.current.y += (target.y - deform.current.y) * sk;
    deform.current.z += (target.z - deform.current.z) * sk;
    (material.uniforms.u_center.value as Vector3).set(bx, by, bz);
    (material.uniforms.u_deform.value as Vector3).set(
      deform.current.x,
      deform.current.y,
      deform.current.z,
    );
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
