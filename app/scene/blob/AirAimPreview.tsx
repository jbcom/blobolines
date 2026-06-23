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
 * is heading"). Every frame it forward-integrates the blob's current position + velocity under
 * gravity plus the steering accel the player is applying, and draws that exact path as a soft tube.
 * What you see is what the physics will do — not an abstract drag indicator.
 *
 * Only shown while airborne and actively steering (a held drag), so it appears the instant you take
 * mid-air control and clears when you let go. Pure read of the diagnostics/steer bridges — never
 * touches the body.
 */
const RADIUS = 0.06;
const MIN_POINTS = 3;

export function AirAimPreview() {
  const meshRef = useRef<Mesh>(null);

  useFrame(() => {
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

    const samples = projectTrajectory(
      {
        position: diag.position,
        velocity: diag.velocity,
        steer: [sx, sz],
        gravity: GRAVITY,
      },
      { step: 0.05, maxPoints: 56, maxDrop: 40 },
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
    mesh.visible = true;
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
