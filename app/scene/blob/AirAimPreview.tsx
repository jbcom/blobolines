import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { AdditiveBlending, CatmullRomCurve3, type Mesh, TubeGeometry, Vector3 } from "three";
import { GRAVITY } from "@/sim/physics";
import { projectTrajectory } from "@/sim/trajectory";
import { getAirSteer, getBlobDiagnostics } from "@/state";
import { palette } from "@/styles/tokens";

/**
 * The mid-air AIM ARC — a live predicted trajectory so the player can READ where the blob is
 * heading (their words: "the point of the arc is you should be able to know from the arc where it
 * is heading"). It forward-integrates the blob's current position + velocity under gravity plus the
 * steering accel the player is applying, and draws that path as a soft tube — a close prediction of
 * the body's motion (same model as PlayerBlob's air step; the fixed integration step is a coarser
 * approximation of the variable frame dt, so it reads as a guide, not a frame-exact replay).
 *
 * Only shown while airborne and actively steering (a held drag), so it appears the instant you take
 * mid-air control and clears when you let go. Pure read of the diagnostics/steer bridges — never
 * touches the body. The geometry rebuild is throttled (~20Hz) so a held steer doesn't allocate a
 * fresh TubeGeometry every frame on a mid-tier phone — the path moves slowly enough to read smooth.
 */
const RADIUS = 0.06;
const MIN_POINTS = 3;
const REBUILD_INTERVAL = 1 / 20; // seconds between geometry rebuilds while steering

export function AirAimPreview() {
  const meshRef = useRef<Mesh>(null);
  const lastBuild = useRef(-1);

  useFrame((state) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const diag = getBlobDiagnostics();
    const [sx, sz] = getAirSteer();
    const steering = sx !== 0 || sz !== 0;
    // Show only when airborne AND steering — the arc is a steering aid, not always-on clutter.
    if (!diag.airborne || !steering) {
      mesh.visible = false;
      return;
    }

    // Throttle the (allocating) geometry rebuild; the tube stays visible between rebuilds.
    mesh.visible = true;
    const now = state.clock.elapsedTime;
    if (now - lastBuild.current < REBUILD_INTERVAL) return;
    lastBuild.current = now;

    const samples = projectTrajectory(
      {
        position: diag.position,
        velocity: diag.velocity,
        steer: [sx, sz],
        gravity: GRAVITY,
      },
      { step: 0.02, maxPoints: 96, maxDrop: 40 },
    );
    if (samples.length < MIN_POINTS) {
      mesh.visible = false;
      return;
    }

    const points = samples.map(([x, y, z]) => new Vector3(x, y, z));
    const curve = new CatmullRomCurve3(points);
    const next = new TubeGeometry(curve, Math.max(16, points.length * 2), RADIUS, 8, false);
    const previous = mesh.geometry;
    mesh.geometry = next;
    previous.dispose();
  });

  return (
    <mesh ref={meshRef} frustumCulled={false} renderOrder={49} visible={false}>
      <bufferGeometry />
      <meshBasicMaterial
        color={palette.blob.blue}
        transparent
        opacity={0.6}
        depthTest={false}
        depthWrite={false}
        toneMapped={false}
        blending={AdditiveBlending}
      />
    </mesh>
  );
}
