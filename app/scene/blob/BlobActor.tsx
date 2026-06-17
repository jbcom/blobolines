import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import type { Color, Group, Mesh, ShaderMaterial, Vector3 } from "three";
import { SphereGeometry } from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { ADDITION, Brush, Evaluator } from "three-bvh-csg";
import type { BlobSkin, EyeExpression } from "@/core/types";
import { bodyLobes } from "@/render/goo";
import { GooMaterial } from "@/render/materials";
import { combineScale, impactSquash, speedStretch } from "@/sim/blob";
import { getBlobDiagnostics } from "@/state";
import { palette } from "@/styles/tokens";
import { BlobEyes } from "./BlobEyes";

/**
 * The gooey blob actor — a goo-shaded sphere that squashes and stretches with motion +
 * impact, wearing the procedural expressive eyes. This component owns only the visual
 * deformation + material.
 *
 * Two modes:
 *  - `live`: read velocity/impact/expression from the diagnostics bridge each frame
 *    (the in-game blob, driven by Rapier) — NO per-frame React re-render.
 *  - props: static velocity/impact/expression (menu hero blob + fixture tests).
 */

interface BlobActorProps {
  skin?: BlobSkin;
  /** Current velocity (drives stretch). Ignored when `live`. */
  velocity?: readonly [number, number, number];
  /** Recent impact amount [0,1] (drives squash). Ignored when `live`. */
  impact?: number;
  /** Eye expression. Ignored when `live`. */
  expression?: EyeExpression;
  radius?: number;
  /** Read live state from the diagnostics bridge instead of props. */
  live?: boolean;
  /** Render the solid goo sphere body. Off when a merged in-game goo body owns the skin
   *  (the eyes + squash group still apply). Default on (menu/fixtures). */
  body?: boolean;
}

const HERO_CSG_REBUILD_DT = 1 / 18;

function HeroGooBody({
  material,
  radius,
  velocity,
  impact,
}: {
  material: ShaderMaterial;
  radius: number;
  velocity: readonly [number, number, number];
  impact: number;
}) {
  const meshRef = useRef<Mesh>(null);
  const lastCsgBuild = useRef(-Infinity);

  const csg = useMemo(() => {
    const evaluator = new Evaluator();
    evaluator.attributes = ["position", "normal"];
    evaluator.useGroups = false;

    const blobBrush = new Brush(new SphereGeometry(radius, 32, 22));
    const tmpLobe = new SphereGeometry(1, 18, 14);
    const lobeGeo = mergeVertices(tmpLobe);
    tmpLobe.dispose();
    const lobeBrushes = Array.from({ length: 3 }, () => new Brush(lobeGeo));
    const ping = new Brush();
    const pong = new Brush();
    return { evaluator, blobBrush, lobeGeo, lobeBrushes, ping, pong };
  }, [radius]);

  useEffect(() => {
    const { blobBrush, lobeGeo, ping, pong } = csg;
    return () => {
      blobBrush.geometry.dispose();
      lobeGeo.dispose();
      ping.geometry?.dispose();
      pong.geometry?.dispose();
    };
  }, [csg]);

  useFrame((state) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const time = state.clock.elapsedTime;
    if (time - lastCsgBuild.current < HERO_CSG_REBUILD_DT) return;
    lastCsgBuild.current = time;

    const { evaluator, blobBrush, lobeBrushes, ping, pong } = csg;
    blobBrush.position.set(0, 0, 0);
    blobBrush.updateMatrixWorld();

    const prevDisplayed = mesh.geometry;
    let acc: Brush = blobBrush;
    let usePing = true;
    const unionInto = (input: Brush, brush: Brush): Brush => {
      if (input !== blobBrush) (input as Brush & { _hash: string | null })._hash = null;
      const target = usePing ? ping : pong;
      const old = target.geometry;
      if (old && old !== mesh.geometry) old.dispose();
      const out = evaluator.evaluate(input, brush, ADDITION, target);
      usePing = !usePing;
      return out;
    };

    const idleSeconds = time + 2.8;
    const excitement = 0.28 + Math.sin(time * 1.35) * 0.12 + impact * 0.45;
    const lobes = bodyLobes({
      time,
      settled: 1,
      velocity,
      radius,
      aimCharge: 0,
      idleSeconds,
      excitement,
    });

    for (let i = 0; i < lobes.length; i++) {
      const lobe = lobes[i];
      const brush = lobeBrushes[i];
      const heroPulse = 1 + Math.sin(time * 1.6 + i * 1.7) * 0.08;
      brush.position.set(lobe.position[0] * 1.26, lobe.position[1] * 1.08, lobe.position[2] * 1.26);
      brush.scale.set(
        lobe.scale[0] * (1.34 + i * 0.05) * heroPulse,
        lobe.scale[1] * (1.22 + i * 0.04),
        lobe.scale[2] * (1.34 + i * 0.05) * (2 - heroPulse),
      );
      brush.updateMatrixWorld();
      acc = unionInto(acc, brush);
    }

    if (mesh.geometry !== acc.geometry) mesh.geometry = acc.geometry;
    if (
      prevDisplayed &&
      prevDisplayed !== mesh.geometry &&
      prevDisplayed !== csg.ping.geometry &&
      prevDisplayed !== csg.pong.geometry
    ) {
      prevDisplayed.dispose();
    }
  });

  return <mesh ref={meshRef} material={material} frustumCulled={false} />;
}

export function BlobActor({
  skin = "blue",
  velocity = [0, 0, 0],
  impact = 0,
  expression = "idle",
  radius = 0.85,
  live = false,
  body = true,
}: BlobActorProps) {
  const groupRef = useRef<Group>(null);
  const material = useMemo(() => new GooMaterial() as unknown as ShaderMaterial, []);
  /** Surface-tension wobble envelope [0,1] — spikes on impact, decays each frame. */
  const wobble = useRef(0);

  // Release the compiled shader program when this blob unmounts (respawn, skin swap, HMR).
  useEffect(() => () => material.dispose(), [material]);

  // Keep material color in sync with the equipped skin (side effect → useEffect).
  useEffect(() => {
    (material.uniforms.uColor.value as Color).set(palette.blob[skin]);
    (material.uniforms.uRim.value as Color).set(palette.goo.rim);
  }, [material, skin]);

  useFrame((state, dt) => {
    material.uniforms.uTime.value = state.clock.elapsedTime;

    const g = groupRef.current;
    if (!g) return;

    const vel = live ? getBlobDiagnostics().velocity : velocity;
    const imp = live ? 1 - getBlobDiagnostics().squash : impact;

    const stretch = speedStretch(vel[0], vel[1], vel[2]);
    const squash = impactSquash(imp);
    const s = combineScale(stretch, squash);
    // Smooth toward the target deformation so it springs rather than snaps.
    const k = 1 - Math.exp(-dt / 0.06);
    g.scale.x += (s.x - g.scale.x) * k;
    g.scale.y += (s.y - g.scale.y) * k;
    g.scale.z += (s.z - g.scale.z) * k;

    // Surface-tension wobble: a fresh impact pumps the envelope up (toward the impact
    // amount), then it decays so the goo skin ripples and settles like a water balloon. A small
    // constant floor keeps the hero subtly alive (never a perfectly still surface) at rest.
    wobble.current = Math.max(wobble.current * Math.exp(-dt / 0.5), imp);
    material.uniforms.uWobble.value = Math.max(0.1, wobble.current);

    // Idle gooeyness so the hero blob is never a CLEAN sphere even at rest (the "less ball"
    // feedback) — but SUBTLE: the eyes are separate meshes that don't follow vertex-level
    // displacement, so a strong sag/lobe detaches them from the body. Keep it just enough to
    // read as a living goo droplet (a soft uneven wobble + faint hang) without the eyes
    // drifting off the deformed mass. ONLY in the posed (non-live) hero/fixture path —
    // in-game the GooCsg blob owns these uniforms off the physics settle, so we never clobber
    // them here (this BlobActor instance is the menu hero; guarding keeps the contract clean).
    if (!live) {
      const t = state.clock.elapsedTime;
      material.uniforms.uSag.value = 0.16;
      material.uniforms.uLobe.value = 0.14 + 0.05 * Math.sin(t * 0.7);
      (material.uniforms.uLobeDir.value as Vector3).set(
        Math.cos(t * 0.5),
        Math.sin(t * 0.31) * 0.4,
        Math.sin(t * 0.5),
      );
    }
  });

  return (
    <group ref={groupRef}>
      {body &&
        (live ? (
          <mesh material={material}>
            <sphereGeometry args={[radius, 48, 48]} />
          </mesh>
        ) : (
          <HeroGooBody material={material} radius={radius} velocity={velocity} impact={impact} />
        ))}
      <BlobEyes expression={expression} radius={radius} live={live} />
    </group>
  );
}
