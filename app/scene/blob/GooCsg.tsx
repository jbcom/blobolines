import { useFrame, useThree } from "@react-three/fiber";
import { damp } from "maath/easing";
import { useEffect, useMemo, useRef } from "react";
import {
  type Color,
  type Group,
  IcosahedronGeometry,
  type Mesh,
  type ShaderMaterial,
  SphereGeometry,
  type Vector3,
} from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { ADDITION, Brush, Evaluator } from "three-bvh-csg";
import { blob as blobCfg, goo as gooCfg } from "@/config";
import type { BlobSkin } from "@/core/types";
import { selectMerges } from "@/render/goo";
import { GooMaterial } from "@/render/materials";
import type { Droplet } from "@/render/vfx";
import { combineScale, impactSquash, speedStretch } from "@/sim/blob";
import { getAim, getBlobDiagnostics } from "@/state";
import { palette } from "@/styles/tokens";
import { BlobEyes } from "./BlobEyes";

/**
 * GooCsg — the REAL goo skin: actual merging 3D mesh geometry via three-bvh-csg, not a
 * shaded sphere. The blob body + nearby splash droplets are unioned (ADDITION) into one
 * continuous mesh each frame, so droplets visibly fuse into the body with true topology
 * (a real World-of-Goo merge), then the result is shaded wet with GooMaterial and
 * squashed/stretched. This is GOO, not a ball. Driven imperatively off the diagnostics
 * bridge — no per-frame React re-render. This is the ONE goo path (no fallback): if CSG
 * fails it must be fixed here, not silently degraded to a lesser blob.
 *
 * Perf: ONE reused Evaluator (geometry buffer pooling), ping-pong target Brushes so the
 * union chain allocates nothing per frame, droplet merges bounded by goo.csg.maxMerges.
 */
interface GooCsgProps {
  skin: BlobSkin;
  blobRadius: number;
  getDroplets: () => readonly Droplet[];
}

const { maxMerges, blobSegments, dropletDetail } = gooCfg.csg;

export function GooCsg({ skin, blobRadius, getDroplets }: GooCsgProps) {
  const groupRef = useRef<Group>(null);
  const resultRef = useRef<Mesh>(null);
  const eyesRef = useRef<Group>(null);
  const camera = useThree((s) => s.camera);

  /** Surface-tension wobble envelope [0,1] — spikes on impact, decays each frame. */
  const wobble = useRef(0);
  /** Current squash/stretch deform, sprung toward the target each frame. */
  const deform = useRef({ x: 1, y: 1, z: 1 });
  /** Directional lean (radians, sprung) — the body tilts toward its horizontal motion. */
  const lean = useRef({ x: 0, z: 0 });
  /** Sprung gooey deform-mode amounts: wet sag (rest droop) + asymmetric lobe (wandering
   *  fat side), eased so they ramp/decay smoothly instead of popping with state changes. */
  const modes = useRef({ sag: 0, lobe: 0.25 });

  const material = useMemo(() => new GooMaterial() as unknown as ShaderMaterial, []);

  // The CSG machinery: one evaluator (pooled buffers), a unit-ish blob brush + a pool of
  // droplet brushes reused across frames, and two ping-pong targets for the union chain.
  const csg = useMemo(() => {
    const evaluator = new Evaluator();
    // The merged mesh feeds a procedural shader — it only needs position + normal, so drop
    // uv/groups to halve the per-frame triangle bookkeeping.
    evaluator.attributes = ["position", "normal"];
    evaluator.useGroups = false;

    const blobBrush = new Brush(new SphereGeometry(blobRadius, blobSegments, blobSegments));
    // Droplet brushes are low-poly icospheres (cheap, round enough once unioned + wet-lit).
    // IcosahedronGeometry is non-indexed; three-bvh-csg's BVH needs an index, so weld it.
    // mergeVertices returns a NEW geometry — dispose the temporary unindexed source so it
    // doesn't leak. All droplet brushes share the one welded geometry.
    const tmpIco = new IcosahedronGeometry(1, dropletDetail);
    const dropletGeo = mergeVertices(tmpIco);
    tmpIco.dispose();
    const dropletBrushes = Array.from({ length: maxMerges }, () => new Brush(dropletGeo));
    const ping = new Brush();
    const pong = new Brush();
    return { evaluator, blobBrush, dropletGeo, dropletBrushes, ping, pong };
  }, [blobRadius]);

  // Release GL programs + CSG geometry on unmount (respawn/skin-swap/HMR remounts this).
  useEffect(() => {
    const { blobBrush, dropletGeo, ping, pong } = csg;
    return () => {
      material.dispose();
      blobBrush.geometry.dispose();
      dropletGeo.dispose(); // shared by every droplet brush
      ping.geometry?.dispose();
      pong.geometry?.dispose();
    };
  }, [csg, material]);

  // Keep material color in sync with the equipped skin.
  useEffect(() => {
    (material.uniforms.uColor.value as Color).set(palette.blob[skin]);
    (material.uniforms.uRim.value as Color).set(palette.goo.rim);
  }, [material, skin]);

  useFrame((state, dt) => {
    const group = groupRef.current;
    const result = resultRef.current;
    if (!group || !result) return;

    const diag = getBlobDiagnostics();
    const [bx, by, bz] = diag.position;

    material.uniforms.uTime.value = state.clock.elapsedTime;

    // ── Build the merged goo mesh (blob ∪ nearby droplets) in the blob's LOCAL frame ──
    // The group is positioned at the blob, so brushes live at blob-relative offsets and
    // the union result is local — cheaper + keeps the deform/scale on the group simple.
    const { evaluator, blobBrush, dropletBrushes, ping, pong } = csg;
    blobBrush.position.set(0, 0, 0);
    blobBrush.updateMatrixWorld();

    const droplets = getDroplets();
    const positions = droplets.map((d) => d.position);
    const merges = selectMerges([bx, by, bz], blobRadius, positions, maxMerges);

    // Chain ADDITION over the merging droplets, ping-ponging targets so nothing allocates.
    let acc: Brush = blobBrush;
    let useping = true;
    for (let i = 0; i < merges.length; i++) {
      const m = merges[i];
      const d = droplets[m.index];
      const brush = dropletBrushes[i];
      // Local offset from the blob; droplet radius grows slightly with merge weight so a
      // fully-overlapping droplet reads as fused mass, a far one as a small bud.
      brush.position.set(d.position[0] - bx, d.position[1] - by, d.position[2] - bz);
      const r = d.radius * (0.7 + 0.5 * m.weight);
      brush.scale.setScalar(r);
      brush.updateMatrixWorld();
      // A Brush used as an evaluate TARGET comes back with boundsTree=null but its cached
      // geometry hash unchanged, so prepareGeometry() early-returns and never rebuilds the
      // BVH — feeding it back as an input then throws `bvhcast of null` every frame. Clear
      // the hash on a result-as-input so the Evaluator rebuilds its bounds tree. (Confirmed
      // root cause; without this the whole CSG goo path errors out.)
      if (acc !== blobBrush) (acc as Brush & { _hash: string | null })._hash = null;
      const target = useping ? ping : pong;
      // evaluate() overwrites target.geometry with a freshly-generated BufferGeometry and
      // does NOT free the old one — a per-frame GPU leak. Dispose the outgoing geometry
      // first, unless it's the one the mesh is currently rendering (last frame's result).
      const old = target.geometry;
      if (old && old !== result.geometry) old.dispose();
      acc = evaluator.evaluate(acc, brush, ADDITION, target);
      useping = !useping;
    }

    // Hand the merged geometry to the rendered mesh (shared buffer — no copy).
    if (result.geometry !== acc.geometry) result.geometry = acc.geometry;

    // ── Wet wobble + squash/stretch (same juice model as the hero blob) ──
    const imp = Math.min(1, Math.max(0, (1 - diag.squash) / 0.3));
    // A FRESH impact spikes the surface-tension wobble well past the impact amount, so a
    // hard landing sends a big travelling ripple across the goo that settles like a water
    // balloon (decays each frame). Overshoot factor makes it read fluid, not stiff.
    wobble.current = Math.max(wobble.current * Math.exp(-dt / blobCfg.wobbleDecayTau), imp * 1.6);
    material.uniforms.uWobble.value = Math.min(1.4, wobble.current);

    const [vx, vy, vz] = diag.velocity;

    // Impact direction = where the goo is moving (the ripple travels FROM the contact, i.e.
    // along the motion at the moment of impact). Falls back to straight-down while resting.
    const vMag = Math.hypot(vx, vy, vz);
    if (vMag > 0.5) {
      (material.uniforms.uImpactDir.value as Vector3).set(vx / vMag, vy / vMag, vz / vMag);
    }

    // ASYMMETRIC lobe: a slow-wandering fat side so Blobby is never a clean sphere even idle.
    // The bulge amount eases up at rest/low-speed (a heavy settled glob bulges) and the
    // direction sweeps on a slow Lissajous so the fat side migrates around the body.
    const t = state.clock.elapsedTime;
    (material.uniforms.uLobeDir.value as Vector3).set(
      Math.cos(t * 0.6),
      Math.sin(t * 0.37) * 0.5,
      Math.sin(t * 0.6),
    );
    let target = combineScale(speedStretch(vx, vy, vz), impactSquash(imp));

    // Puddle at rest: settle into a wide flat happy puddle when grounded + slow, with a slow
    // breathe so Blobby is never a perfectly static ball even standing still.
    const settled = diag.airborne ? 0 : 1 - Math.min(diag.speed / blobCfg.puddle.settleSpeed, 1);

    // WET SAG eases in as Blobby settles (a resting glob hangs/bulges under its weight); the
    // ASYMMETRIC lobe is always a little present (never a clean sphere) and grows when settled.
    damp(modes.current, "sag", settled, 0.18, dt);
    damp(modes.current, "lobe", 0.25 + settled * 0.4, 0.3, dt);
    material.uniforms.uSag.value = modes.current.sag;
    material.uniforms.uLobe.value = modes.current.lobe;

    if (settled > 0.01) {
      const [px, py, pz] = blobCfg.puddle.scale;
      const breathe = Math.sin(state.clock.elapsedTime * 1.8) * 0.04 * settled;
      target = {
        x: target.x + (px - target.x) * settled + breathe,
        y: target.y + (py - target.y) * settled - breathe,
        z: target.z + (pz - target.z) * settled + breathe,
      };
    }
    // Charging the slingshot: the resting puddle gathers up toward the pull.
    const aim = getAim();
    if (aim && !diag.airborne) {
      const g = Math.min(aim.charge, 1);
      target = {
        x: target.x * (1 - g * 0.22),
        y: target.y * (1 + g * 0.45),
        z: target.z * (1 - g * 0.22),
      };
    }
    // Frame-rate-independent critically-damped spring toward the target deform (maath).
    damp(deform.current, "x", target.x, blobCfg.deformSpringTau, dt);
    damp(deform.current, "y", target.y, blobCfg.deformSpringTau, dt);
    damp(deform.current, "z", target.z, blobCfg.deformSpringTau, dt);

    // Position + squash the whole goo group at the blob. A squashed puddle (deform.y<1)
    // drops its center so it sits ON the pad instead of hovering a radius up.
    const squash = Math.min(1, deform.current.y);
    group.position.set(bx, by - blobRadius * (1 - squash), bz);
    group.scale.set(deform.current.x, deform.current.y, deform.current.z);
    // Directional LEAN: tilt the whole body toward its horizontal travel (a fluid body leans
    // into motion, never a rigid upright ball). Spring the tilt so it lags + overshoots a
    // touch. Magnitude scales with horizontal speed, capped so it stays a lean not a faceplant.
    const hSpeed = Math.hypot(vx, vz);
    const leanK = Math.min(hSpeed / 26, 1) * 0.5; // radians, capped ~0.5
    damp(lean.current, "x", (vz / (hSpeed || 1)) * leanK, 0.12, dt);
    damp(lean.current, "z", (-vx / (hSpeed || 1)) * leanK, 0.12, dt);
    group.rotation.set(lean.current.x, 0, lean.current.z);

    // Eyes ride the goo face, billboarded at the blob center (counter the group scale so
    // they don't squash with the body).
    const eyes = eyesRef.current;
    if (eyes) {
      eyes.position.set(0, blobRadius * (1 - squash), 0);
      eyes.scale.set(1 / deform.current.x, 1 / deform.current.y, 1 / deform.current.z);
      eyes.lookAt(camera.position);
    }
  });

  return (
    <group ref={groupRef}>
      {/* frustumCulled off: the geometry is swapped to a fresh CSG result each frame, so its
          bounding sphere is stale/empty and three would cull the whole body at altitude
          (eyes use depthTest-independent meshes and survived, body vanished). It's one small
          object always at the blob — culling it saves nothing. */}
      <mesh ref={resultRef} material={material} frustumCulled={false} />
      <group ref={eyesRef} renderOrder={2}>
        <BlobEyes expression="idle" radius={blobRadius} live />
      </group>
    </group>
  );
}
