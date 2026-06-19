import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import type { InstancedMesh, Mesh, MeshBasicMaterial } from "three";
import { AdditiveBlending, DoubleSide, Matrix4, Quaternion, Vector3 } from "three";
import type { Vec3, WorldDifficulty } from "@/core/types";
import { launchVelocity } from "@/sim/launch";
import { GRAVITY } from "@/sim/physics";
import {
  effectiveRouteDifficulty,
  getAim,
  getBlobDiagnostics,
  setBlobFaceFocusTarget,
  useGameStore,
  useWorldStore,
} from "@/state";
import { hex, palette } from "@/styles/tokens";
import { nextRouteStep, PAD_SURFACE_Y, type RouteStep } from "@/world";

/**
 * Aim/targeting feedback while the player charges. Reads the live aim from the bridge each
 * frame and runs the SAME launchVelocity the blob will use. The guide stays visible at every
 * difficulty; expert tiers tighten the viable release, they do not remove the readable arc.
 */
const DOTS = 26;
const MAX_ENDPOINT_TIME = 4.5;
/** World-distance between plotted dots — fixed spacing reads as an even aim line
 *  regardless of launch speed (time-stepping flung the dots metres apart on a hard pull). */
const DOT_SPACING = 1.1;
const tmpPos = new Vector3();
const tmpScale = new Vector3();
const tmpQuat = new Quaternion();
const tmpMat = new Matrix4();

export interface AimEndpoint {
  position: Vec3;
  time: number;
}

export function showsAimEndpointReticle(difficulty: WorldDifficulty): boolean {
  return Boolean(difficulty);
}

export function showsAimParabola(difficulty: WorldDifficulty): boolean {
  return Boolean(difficulty);
}

export function aimAssistDifficulty(
  startingDifficulty: WorldDifficulty,
  routeSourceY: number | null | undefined,
  runHeight: number,
): WorldDifficulty {
  const routeY = routeSourceY ?? 0;
  return effectiveRouteDifficulty(startingDifficulty, Math.max(0, routeY, runHeight));
}

export function aimEndpointTargetY(step: RouteStep | null): number | null {
  if (!step) return null;
  const gate = step.proof?.routeGate;
  if (gate?.kind === "slicer") return gate.position[1];
  return step.target.position[1] + PAD_SURFACE_Y;
}

export function aimEndpointHitsStep(step: RouteStep | null, endpoint: AimEndpoint | null): boolean {
  if (!step || !endpoint) return false;
  const gate = step.proof?.routeGate;
  if (gate?.kind === "slicer") {
    return (
      Math.hypot(
        endpoint.position[0] - gate.position[0],
        endpoint.position[2] - gate.position[2],
      ) <= gate.radius
    );
  }
  const dx = Math.abs(endpoint.position[0] - step.target.position[0]);
  const dz = Math.abs(endpoint.position[2] - step.target.position[2]);
  return dx <= step.target.width * 0.5 && dz <= step.target.depth * 0.5;
}

export function solveAimEndpoint(
  origin: Vec3,
  velocity: Vec3,
  targetY: number,
  gravityY: number,
  maxTime = MAX_ENDPOINT_TIME,
): AimEndpoint | null {
  const a = 0.5 * gravityY;
  const b = velocity[1];
  const c = origin[1] - targetY;
  const disc = b * b - 4 * a * c;
  if (disc < 0 || Math.abs(a) < 1e-6) return null;

  const root = Math.sqrt(disc);
  const roots = [(-b - root) / (2 * a), (-b + root) / (2 * a)]
    .filter((t) => t > 0.06 && t <= maxTime)
    .sort((x, y) => x - y);
  const time = roots.find((t) => velocity[1] + gravityY * t <= 0);
  if (time === undefined) return null;

  return {
    time,
    position: [origin[0] + velocity[0] * time, targetY, origin[2] + velocity[2] * time],
  };
}

export function TrajectoryPreview() {
  const meshRef = useRef<InstancedMesh>(null);
  const reticleRef = useRef<Mesh>(null);
  const haloRef = useRef<Mesh>(null);
  const color = useMemo(() => palette.goo.rim, []);

  useFrame((state) => {
    const mesh = meshRef.current;
    const reticle = reticleRef.current;
    const halo = haloRef.current;
    if (!mesh || !reticle || !halo) return;
    const aim = getAim();
    if (!aim) {
      mesh.count = 0;
      mesh.instanceMatrix.needsUpdate = true;
      reticle.visible = false;
      halo.visible = false;
      setBlobFaceFocusTarget(null);
      return;
    }

    const diag = getBlobDiagnostics();
    const [bx, by, bz] = diag.position;
    const game = useGameStore.getState();
    const world = useWorldStore.getState();
    const combo = game.run.combo;
    const v = launchVelocity(aim.dir, aim.charge, "standard", combo);
    const step = nextRouteStep(diag.groundY, world.trampolines);
    const activeDifficulty = aimAssistDifficulty(
      world.difficulty,
      step?.source?.position[1] ?? diag.groundY,
      game.run.height,
    );
    if (!showsAimParabola(activeDifficulty)) {
      mesh.count = 0;
      mesh.instanceMatrix.needsUpdate = true;
      reticle.visible = false;
      halo.visible = false;
      setBlobFaceFocusTarget(null);
      return;
    }

    const targetY = aimEndpointTargetY(step);
    const endpoint =
      targetY !== null && showsAimEndpointReticle(activeDifficulty)
        ? solveAimEndpoint(diag.position, v, targetY, GRAVITY[1])
        : null;
    const validEndpoint = aimEndpointHitsStep(step, endpoint) ? endpoint : null;

    const targetEndpoint = endpoint || validEndpoint;
    if (targetEndpoint) {
      setBlobFaceFocusTarget({
        kind: step?.proof?.routeGate?.kind === "slicer" ? "slicer" : "routeEndpoint",
        position: targetEndpoint.position,
        intensity: Math.max(0.25, Math.min(1, aim.charge)),
      });
      for (let shown = 0; shown < DOTS; shown++) {
        const t = targetEndpoint.time * ((shown + 1) / DOTS);
        const x = bx + v[0] * t;
        const y = by + v[1] * t + 0.5 * GRAVITY[1] * t * t;
        const z = bz + v[2] * t;
        tmpPos.set(x, y, z);
        const s = 0.18 * (1 - (shown / DOTS) * 0.6);
        tmpScale.setScalar(s);
        tmpMat.compose(tmpPos, tmpQuat, tmpScale);
        mesh.setMatrixAt(shown, tmpMat);
      }
      mesh.count = DOTS;
      mesh.instanceMatrix.needsUpdate = true;

      const pulse = 1 + Math.sin(state.clock.elapsedTime * 6.5) * 0.08;
      const base = activeDifficulty === "ready" ? 0.9 : activeDifficulty === "medium" ? 0.75 : 0.62;
      reticle.position.set(...targetEndpoint.position);
      halo.position.copy(reticle.position);
      reticle.scale.setScalar(base * pulse);
      halo.scale.setScalar(base * (1.28 + (pulse - 1) * 1.6));

      // Dynamic color/style: Gold if hit, danger-red if missed
      if (validEndpoint) {
        (reticle.material as MeshBasicMaterial).color.set(hex(palette.tramp.gold));
        (halo.material as MeshBasicMaterial).color.set(hex(palette.goo.rim));
        (reticle.material as MeshBasicMaterial).opacity = 0.72;
        (halo.material as MeshBasicMaterial).opacity = 0.18 + (pulse - 1) * 0.55;
      } else {
        (reticle.material as MeshBasicMaterial).color.set(hex(palette.danger));
        (halo.material as MeshBasicMaterial).color.set(hex(palette.danger));
        (reticle.material as MeshBasicMaterial).opacity = 0.55;
        (halo.material as MeshBasicMaterial).opacity = 0.12 + (pulse - 1) * 0.35;
      }

      reticle.visible = true;
      halo.visible = true;
      return;
    }

    reticle.visible = false;
    halo.visible = false;
    setBlobFaceFocusTarget(null);

    // Plot the ballistic arc p(t) = p0 + v·t + ½·g·t², but place a dot every DOT_SPACING
    // world-units of arc length (not per fixed time) so the line is evenly readable at any
    // launch power. Walk t forward in small sub-steps, dropping a dot each time we've
    // travelled another DOT_SPACING.
    const speed = Math.hypot(v[0], v[1], v[2]) || 1;
    const dt = DOT_SPACING / speed / 3; // 3 sub-steps per spacing for a smooth arc
    let shown = 0;
    let acc = 0;
    let px = bx;
    let py = by;
    let pz = bz;
    for (let i = 1; i <= DOTS * 6 && shown < DOTS; i++) {
      const t = i * dt;
      const x = bx + v[0] * t;
      const y = by + v[1] * t + 0.5 * GRAVITY[1] * t * t;
      const z = bz + v[2] * t;
      acc += Math.hypot(x - px, y - py, z - pz);
      px = x;
      py = y;
      pz = z;
      if (y < by - 1 && shown > 2) break; // stop a bit past the apex
      if (acc < DOT_SPACING) continue;
      acc = 0;
      tmpPos.set(x, y, z);
      // Dots shrink along the path for a tapering aim line.
      const s = 0.18 * (1 - (shown / DOTS) * 0.6);
      tmpScale.setScalar(s);
      tmpMat.compose(tmpPos, tmpQuat, tmpScale);
      mesh.setMatrixAt(shown, tmpMat);
      shown++;
    }
    mesh.count = shown;
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh ref={meshRef} args={[undefined, undefined, DOTS]} frustumCulled={false}>
        <sphereGeometry args={[1, 8, 8]} />
        <meshBasicMaterial color={hex(color)} transparent opacity={0.7} depthWrite={false} />
      </instancedMesh>
      <mesh
        ref={haloRef}
        rotation={[-Math.PI / 2, 0, 0]}
        frustumCulled={false}
        renderOrder={42}
        visible={false}
      >
        <ringGeometry args={[0.72, 1.12, 72]} />
        <meshBasicMaterial
          color={hex(palette.goo.rim)}
          transparent
          opacity={0.18}
          depthWrite={false}
          depthTest={false}
          side={DoubleSide}
          blending={AdditiveBlending}
        />
      </mesh>
      <mesh
        ref={reticleRef}
        rotation={[-Math.PI / 2, 0, 0]}
        frustumCulled={false}
        renderOrder={43}
        visible={false}
      >
        <ringGeometry args={[0.78, 1, 72]} />
        <meshBasicMaterial
          color={hex(palette.tramp.gold)}
          transparent
          opacity={0.72}
          depthWrite={false}
          depthTest={false}
          side={DoubleSide}
          blending={AdditiveBlending}
        />
      </mesh>
    </group>
  );
}
