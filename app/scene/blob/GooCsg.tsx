import { useFBO } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { damp } from "maath/easing";
import { useEffect, useMemo, useRef } from "react";
import {
  type Color,
  CylinderGeometry,
  type Group,
  IcosahedronGeometry,
  type Mesh,
  type ShaderMaterial,
  SphereGeometry,
  Vector2,
  Vector3,
} from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { ADDITION, Brush, Evaluator } from "three-bvh-csg";
import { biomeSkyAt, blob as blobCfg, goo as gooCfg } from "@/config";
import type { BlobSkin } from "@/core/types";
import { bodyLobes, bridgeFor, selectMerges } from "@/render/goo";
import { GooMaterial } from "@/render/materials";
import { getQuality } from "@/render/qualityBridge";
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
/** Constant surface-wobble floor so the goo is never perfectly still — always subtly alive. */
const IDLE_WOBBLE = 0.12;
/** CylinderGeometry points up +Y by default; bridge necks orient FROM this axis to the
 *  blob→droplet axis via setFromUnitVectors. Module-scope reusable (no per-frame allocation). */
const CYL_UP = new Vector3(0, 1, 0);
const tmpAxis = new Vector3();

export function GooCsg({ skin, blobRadius, getDroplets }: GooCsgProps) {
  const groupRef = useRef<Group>(null);
  const resultRef = useRef<Mesh>(null);
  const eyesRef = useRef<Group>(null);
  const bubbleRef = useRef<Mesh>(null);
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const size = useThree((s) => s.size);

  // Backbuffer-refraction is HIGH-tier only — the marquee jelly look where the blob bends what's
  // behind it. We render the scene (with the goo hidden) into a half-res FBO each frame and feed
  // it to the goo shader's uBackbuffer; mid/low keep uRefraction=0 so the pass is skipped. The FBO
  // is allocated unconditionally (hooks stay top-level) but only RENDERED when the LIVE tier (read
  // each frame in the loop) has refraction on, so a runtime tier downgrade stops the pass at once.
  const fbo = useFBO(
    Math.max(2, Math.floor(size.width / 2)),
    Math.max(2, Math.floor(size.height / 2)),
  );
  const resolution = useMemo(() => new Vector2(1, 1), []);

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

  // Blob geometry density scales with the quality tier (low devices get a coarser sphere) — the
  // config value is the high-tier ceiling; getQuality() caps it. In the csg dep array so a
  // quality change (e.g. an FPS-triggered downgrade) rebuilds the CSG brush at the new density.
  const segs = Math.min(blobSegments, getQuality().blobSegments);

  // The CSG machinery: one evaluator (pooled buffers), a unit-ish blob brush + a pool of
  // droplet brushes reused across frames, and two ping-pong targets for the union chain.
  const csg = useMemo(() => {
    const evaluator = new Evaluator();
    // The merged mesh feeds a procedural shader — it only needs position + normal, so drop
    // uv/groups to halve the per-frame triangle bookkeeping.
    evaluator.attributes = ["position", "normal"];
    evaluator.useGroups = false;

    const blobBrush = new Brush(new SphereGeometry(blobRadius, segs, segs));
    // Droplet brushes are low-poly icospheres (cheap, round enough once unioned + wet-lit).
    // IcosahedronGeometry is non-indexed; three-bvh-csg's BVH needs an index, so weld it.
    // mergeVertices returns a NEW geometry — dispose the temporary unindexed source so it
    // doesn't leak. All droplet brushes share the one welded geometry.
    const tmpIco = new IcosahedronGeometry(1, dropletDetail);
    const dropletGeo = mergeVertices(tmpIco);
    tmpIco.dispose();
    const bodyLobeBrushes = Array.from({ length: 3 }, () => new Brush(dropletGeo));
    const dropletBrushes = Array.from({ length: maxMerges }, () => new Brush(dropletGeo));
    // Bridge NECKS: a unit cylinder (radius 1, height 1, centered on origin) per merge slot,
    // scaled/oriented each frame into a stretched teardrop strand between blob + droplet. Few
    // radial segments (it's a thin wet neck once shaded) keep the per-frame union cheap. Welded
    // so three-bvh-csg's BVH has an index (same requirement as the droplet icospheres).
    const tmpCyl = new CylinderGeometry(1, 1, 1, 8, 1);
    const bridgeGeo = mergeVertices(tmpCyl);
    tmpCyl.dispose();
    const bridgeBrushes = Array.from({ length: maxMerges }, () => new Brush(bridgeGeo));
    const ping = new Brush();
    const pong = new Brush();
    return {
      evaluator,
      blobBrush,
      dropletGeo,
      bodyLobeBrushes,
      dropletBrushes,
      bridgeGeo,
      bridgeBrushes,
      ping,
      pong,
    };
  }, [blobRadius, segs]);

  // Release GL programs + CSG geometry on unmount (respawn/skin-swap/HMR remounts this).
  useEffect(() => {
    const { blobBrush, dropletGeo, bridgeGeo, ping, pong } = csg;
    return () => {
      material.dispose();
      blobBrush.geometry.dispose();
      dropletGeo.dispose(); // shared by every droplet brush
      bridgeGeo.dispose(); // shared by every bridge-neck brush
      ping.geometry?.dispose();
      pong.geometry?.dispose();
    };
  }, [csg, material]);

  // Keep material color in sync with the equipped skin.
  useEffect(() => {
    (material.uniforms.uColor.value as Color).set(palette.blob[skin]);
    (material.uniforms.uRim.value as Color).set(palette.goo.rim);
  }, [material, skin]);

  // Bind the backbuffer texture + the resolution Vector2 object once. uRefraction itself is driven
  // LIVE per-frame in the loop (so a tier change takes effect immediately), and the resolution
  // VALUE is refreshed there too — drei's useFBO keeps the SAME target identity across window
  // resizes (resizes in place), so an effect keyed on `fbo` would never re-run for a resize.
  useEffect(() => {
    material.uniforms.uBackbuffer.value = fbo.texture;
    material.uniforms.uResolution.value = resolution;
  }, [material, fbo, resolution]);

  useFrame((state, dt) => {
    const group = groupRef.current;
    const result = resultRef.current;
    if (!group || !result) return;

    // BACKBUFFER pass (HIGH only): render the scene with the goo group hidden into the FBO, so the
    // shader can sample "what's behind the blob" and refract it. Hide → render-to-FBO → restore,
    // all before the main frame draws the goo with the fresh texture. Cheap-ish at half-res.
    // Read the tier LIVE each frame (not the mount-time `refracts`) so a manual Settings downgrade
    // (HIGH→Low) or a future FPS-driven downgrade stops the expensive pass immediately, and keep
    // the shader's uRefraction in lockstep so it doesn't sample a stale/empty FBO.
    const refractNow = getQuality().refraction;
    material.uniforms.uRefraction.value = refractNow ? (gooCfg.refractionStrength ?? 0.06) : 0;
    if (refractNow) {
      // Refresh uResolution from the LIVE fbo size every frame — useFBO resizes the same target in
      // place on a window resize, so this is the only place that reliably tracks the new size.
      resolution.set(fbo.width, fbo.height);
      const wasVisible = group.visible;
      group.visible = false;
      const prevTarget = gl.getRenderTarget();
      // Self-contained clear: EffectComposer manages gl.autoClear and may leave it false, which
      // would ghost/accumulate into the backbuffer FBO. Force a clear for this pass, then restore.
      const prevAutoClear = gl.autoClear;
      gl.autoClear = true;
      gl.setRenderTarget(fbo);
      gl.clear();
      gl.render(scene, camera);
      gl.setRenderTarget(prevTarget);
      gl.autoClear = prevAutoClear;
      group.visible = wasVisible;
    }

    const diag = getBlobDiagnostics();
    const [bx, by, bz] = diag.position;
    const [vx, vy, vz] = diag.velocity;
    const settled = diag.airborne ? 0 : 1 - Math.min(diag.speed / blobCfg.puddle.settleSpeed, 1);
    const cloudCling = Math.min(1, Math.max(0, diag.cloudAdherence?.strength ?? 0));
    // Cloud relX/relZ arrive normalized to the pad half-footprint [-0.5, 0.5]; expand to the
    // full deform range so off-center catches visibly tug the puddle toward that side.
    const cloudRelX = Math.min(1, Math.max(-1, (diag.cloudAdherence?.relX ?? 0) * 2));
    const cloudRelZ = Math.min(1, Math.max(-1, (diag.cloudAdherence?.relZ ?? 0) * 2));
    // Keep cloud cling just shy of fully grounded so the coated puddle still breathes/jiggles.
    const clingSettled = Math.max(settled, cloudCling * 0.95);
    const aim = getAim();
    const idleSeconds = diag.idleSeconds ?? 0;
    const excitement = diag.excitement ?? 0;

    // Biome-reactive goo lighting: tint the blob toward the current sky's key color and ramp
    // the tint strength with altitude (subtle low → moody high), so the goo reads as embedded
    // in its biome (warm at the ground, cool in space). Cheap: one color set + one float/frame.
    const biome = biomeSkyAt(by);
    (material.uniforms.uEnvTint.value as Color).set(biome.top);
    material.uniforms.uEnvLight.value = Math.min(0.7, 0.15 + by / 1400);

    material.uniforms.uTime.value = state.clock.elapsedTime;

    // ── Build the merged goo mesh (blob ∪ nearby droplets) in the blob's LOCAL frame ──
    // The group is positioned at the blob, so brushes live at blob-relative offsets and
    // the union result is local — cheaper + keeps the deform/scale on the group simple.
    const { evaluator, blobBrush, bodyLobeBrushes, dropletBrushes, bridgeBrushes, ping, pong } =
      csg;
    blobBrush.position.set(0, 0, 0);
    blobBrush.updateMatrixWorld();

    const droplets = getDroplets();
    const positions = droplets.map((d) => d.position);
    const merges = selectMerges([bx, by, bz], blobRadius, positions, maxMerges);

    // Chain ADDITION over the merging droplets, ping-ponging targets so nothing allocates.
    // Capture the geometry the mesh is CURRENTLY showing: unionInto skips disposing it mid-chain
    // (it's still on screen), so once we swap in the new result below we must dispose this old one
    // ourselves or it leaks one BufferGeometry per frame (it loses its last reference).
    const prevDisplayed = result.geometry;
    let acc: Brush = blobBrush;
    let useping = true;
    // A Brush used as an evaluate TARGET comes back with boundsTree=null but its cached geometry
    // hash unchanged, so prepareGeometry() early-returns and never rebuilds the BVH — feeding it
    // back as an input then throws `bvhcast of null` every frame. Clear the hash on a result-as-
    // input so the Evaluator rebuilds its bounds tree. (Confirmed root cause; without this the
    // whole CSG goo path errors out.) Factored out so droplet AND bridge unions both apply it.
    const unionInto = (input: Brush, brush: Brush): Brush => {
      if (input !== blobBrush) (input as Brush & { _hash: string | null })._hash = null;
      const target = useping ? ping : pong;
      // evaluate() overwrites target.geometry with a freshly-generated BufferGeometry and does
      // NOT free the old one — a per-frame GPU leak. Dispose the outgoing geometry first, unless
      // it's the one the mesh is currently rendering (last frame's result).
      const old = target.geometry;
      if (old && old !== result.geometry) old.dispose();
      const out = evaluator.evaluate(input, brush, ADDITION, target);
      useping = !useping;
      return out;
    };

    // Intrinsic body lobes: always-fused irregular mass so the player reads a living blob, not a
    // perfect ball, even before splash droplets exist. These are real CSG unions.
    const lobes = bodyLobes({
      time: state.clock.elapsedTime,
      settled: clingSettled,
      velocity: [vx, vy, vz],
      radius: blobRadius,
      aimCharge: aim?.charge ?? 0,
      aimDirection: aim?.dir ?? null,
      idleSeconds,
      excitement,
      cloudAdherence: cloudCling,
      cloudOffset: [cloudRelX, cloudRelZ],
    });
    for (let i = 0; i < lobes.length; i++) {
      const lobe = lobes[i];
      const brush = bodyLobeBrushes[i];
      brush.position.set(lobe.position[0], lobe.position[1], lobe.position[2]);
      brush.scale.set(lobe.scale[0], lobe.scale[1], lobe.scale[2]);
      brush.updateMatrixWorld();
      acc = unionInto(acc, brush);
    }

    // Bound the extra union work the strands add: only the nearest few droplets get a neck
    // (they're nearest-first), so a busy splash doesn't double the per-frame CSG cost. Scales
    // down with the quality tier alongside the droplet merges.
    const maxBridges = Math.min(merges.length, Math.max(2, Math.floor(maxMerges / 2)));
    let bridges = 0;

    for (let i = 0; i < merges.length; i++) {
      const m = merges[i];
      const d = droplets[m.index];
      const brush = dropletBrushes[i];
      // Local offset from the blob; droplet radius grows slightly with merge weight so a
      // fully-overlapping droplet reads as fused mass, a far one as a small bud.
      const lx = d.position[0] - bx;
      const ly = d.position[1] - by;
      const lz = d.position[2] - bz;
      brush.position.set(lx, ly, lz);
      const r = d.radius * (0.7 + 0.5 * m.weight);
      brush.scale.setScalar(r);
      brush.updateMatrixWorld();
      acc = unionInto(acc, brush);

      // STRETCH STRAND: a separating droplet trails a thinning teardrop neck back to the body
      // (the signature World-of-Goo look). bridgeFor returns null when the droplet overlaps
      // (already fused) or has pinched off, so necks only appear in the in-between window.
      const bridge =
        bridges < maxBridges ? bridgeFor([0, 0, 0], blobRadius, [lx, ly, lz], r) : null;
      if (bridge) {
        bridges++;
        const neck = bridgeBrushes[i];
        neck.position.set(bridge.midpoint[0], bridge.midpoint[1], bridge.midpoint[2]);
        // Orient the +Y cylinder onto the blob→droplet axis, then scale: radius on X/Z, full
        // neck length (2·halfLength) on Y.
        tmpAxis.set(bridge.axis[0], bridge.axis[1], bridge.axis[2]);
        neck.quaternion.setFromUnitVectors(CYL_UP, tmpAxis);
        neck.scale.set(bridge.radius, bridge.halfLength * 2, bridge.radius);
        neck.updateMatrixWorld();
        acc = unionInto(acc, neck);
      }
    }

    // Hand the merged geometry to the rendered mesh (shared buffer — no copy).
    if (result.geometry !== acc.geometry) result.geometry = acc.geometry;
    // Dispose the geometry the mesh WAS showing now that it's been replaced — unless it's somehow
    // still live (the new result, or a ping/pong target reused for next frame). Without this the
    // previous frame's result leaks (unionInto deliberately skipped it while it was on screen).
    if (
      prevDisplayed &&
      prevDisplayed !== result.geometry &&
      prevDisplayed !== csg.ping.geometry &&
      prevDisplayed !== csg.pong.geometry
    ) {
      prevDisplayed.dispose();
    }

    // ── Wet wobble + squash/stretch (same juice model as the hero blob) ──
    const imp = Math.min(1, Math.max(0, (1 - diag.squash) / 0.3));
    // A FRESH impact spikes the surface-tension wobble well past the impact amount, so a
    // hard landing sends a big travelling ripple across the goo that settles like a water
    // balloon (decays each frame). Overshoot factor makes it read fluid, not stiff.
    wobble.current = Math.max(wobble.current * Math.exp(-dt / blobCfg.wobbleDecayTau), imp * 1.6);
    // Perpetual idle jiggle: a small constant wobble floor so the goo surface is ALWAYS subtly
    // alive (breathing/shimmering), never a perfectly still surface even when the body itself
    // is at rest — the impact spike rides on top of it.
    material.uniforms.uWobble.value = Math.min(
      1.4,
      Math.max(IDLE_WOBBLE + cloudCling * 0.1, wobble.current + cloudCling * 0.08),
    );

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
    // WET SAG eases in as Blobby settles (a resting glob hangs/bulges under its weight); the
    // ASYMMETRIC lobe is always a little present (never a clean sphere) and grows when settled.
    damp(modes.current, "sag", clingSettled, 0.18, dt);
    damp(modes.current, "lobe", 0.25 + clingSettled * 0.4 + cloudCling * 0.18, 0.3, dt);
    material.uniforms.uSag.value = modes.current.sag;
    material.uniforms.uLobe.value = modes.current.lobe;

    if (clingSettled > 0.01) {
      const [px, py, pz] = blobCfg.puddle.scale;
      const impatience = Math.min(1, Math.max(0, (idleSeconds - 2.2) / 3.2));
      const breathe =
        Math.sin(state.clock.elapsedTime * (1.8 + impatience * 1.2)) *
        (0.06 + excitement * 0.08) *
        clingSettled;
      const perky = Math.max(excitement, impatience * 0.45);
      const coatSpreadX = cloudCling * (0.16 + Math.abs(cloudRelX) * 0.08);
      const coatSpreadZ = cloudCling * (0.16 + Math.abs(cloudRelZ) * 0.08);
      target = {
        x: target.x + (px + coatSpreadX - target.x) * clingSettled + breathe - perky * 0.08,
        y:
          target.y +
          (py - cloudCling * 0.1 + perky * 0.22 - target.y) * clingSettled -
          breathe * 0.35,
        z: target.z + (pz + coatSpreadZ - target.z) * clingSettled + breathe - perky * 0.08,
      };
    }
    // Charging the route launch: the resting puddle gathers up toward the route direction.
    if (aim && !diag.airborne) {
      const g = Math.min(aim.charge, 1);
      target = {
        x: target.x * (1 - g * (0.22 + cloudCling * 0.12)),
        y: target.y * (1 + g * (0.45 + cloudCling * 0.22)),
        z: target.z * (1 - g * (0.22 + cloudCling * 0.12)),
      };
    }
    // Frame-rate-independent critically-damped spring toward the target deform (maath).
    damp(deform.current, "x", target.x, blobCfg.deformSpringTau, dt);
    damp(deform.current, "y", target.y, blobCfg.deformSpringTau, dt);
    damp(deform.current, "z", target.z, blobCfg.deformSpringTau, dt);

    // Position + squash the whole goo group at the blob. A squashed puddle (deform.y<1)
    // drops its center so it sits ON the pad instead of hovering a radius up.
    const squash = Math.min(1, deform.current.y);
    const clingSink = blobRadius * cloudCling * (0.1 - (aim?.charge ?? 0) * 0.04);
    group.position.set(bx, by - blobRadius * (1 - squash) - clingSink, bz);
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

    const bubbleMesh = bubbleRef.current;
    if (bubbleMesh) {
      const active = !!diag.bubbleActive;
      bubbleMesh.visible = active;
      if (active) {
        const t = state.clock.elapsedTime;
        bubbleMesh.rotation.y = t * 1.35;
        bubbleMesh.rotation.x = t * 0.72;
        const pulse = 1.35 + Math.sin(t * 7.5) * 0.05;
        bubbleMesh.scale.set(
          pulse / deform.current.x,
          pulse / deform.current.y,
          pulse / deform.current.z,
        );
      }
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
      <mesh ref={bubbleRef} visible={false}>
        <sphereGeometry args={[blobRadius, 32, 32]} />
        <meshPhongMaterial
          color={palette.cloud.bubble}
          transparent
          opacity={0.35}
          shininess={80}
          specular="#ffffff"
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
