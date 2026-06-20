import { useFrame } from "@react-three/fiber";
import { BallCollider, RigidBody } from "@react-three/rapier";
import { useMemo, useRef, useState } from "react";
import { Color, type Mesh, type MeshStandardMaterial } from "three";
import { playThump } from "@/audio";
import { biomeBandAt } from "@/config";
import { getBlobDiagnostics, reportObstacleBounce, useWorldStore } from "@/state";
import { hex, palette } from "@/styles/tokens";
import type { ObstacleSpec } from "@/world";

/**
 * ObstacleField — the OFF-ROUTE bounce obstacles (see src/world/obstacles.ts). Each is a SOLID
 * fixed Rapier collider the blob physically ricochets off (restitution), distinct from the cloud
 * pads (soft sensors) and gates (pass-through). They never sit on the certified golden path, so
 * they're always optional — brush one for a springy redirect, or steer clear. A per-frame proximity
 * check fires a cosmetic bounce pulse (the actual rebound is Rapier's). Render-windowed like the
 * pads so a long climb keeps a flat live count.
 */

/** How far below / above the blob to keep obstacle colliders mounted (world units). Matches the
 *  pad window so an obstacle is solid exactly when its neighbouring pads are. */
const WINDOW_BELOW = 40;
const WINDOW_ABOVE = 120;
const WINDOW_STEP = 8;

/** Bounce restitution — springy but not a trampoline (pads own the big launches). */
const OBSTACLE_RESTITUTION = 0.55;
/** Proximity (added to the obstacle radius) within which a fast approach fires the cosmetic pulse. */
const CONTACT_PAD = 1.0;
/** Min blob speed for a contact to register as a "bounce" (slow brushes stay silent). */
const MIN_BOUNCE_SPEED = 6;
/** Seconds a contact pulse animates (scale pop + emissive flash). */
const PULSE_LIFE = 0.32;

function windowed(obstacles: readonly ObstacleSpec[], centerY: number): ObstacleSpec[] {
  return obstacles.filter(
    (o) => o.position[1] >= centerY - WINDOW_BELOW && o.position[1] <= centerY + WINDOW_ABOVE,
  );
}

/** Per-band obstacle tint, so an obstacle reads as belonging to its biome (warm rock low, icy
 *  crystal mid, dark asteroid in space). Keyed by the canonical biome band. */
const BAND_COLOR: Record<string, string> = {
  ground: palette.scenery.rock,
  sky: palette.scenery.rock,
  "upper-atmosphere": palette.tramp.ice,
  stratosphere: palette.tramp.violet,
  space: palette.scenery.asteroid,
  "deep-space": palette.scenery.asteroid,
};

function ObstacleBody({ spec }: { spec: ObstacleSpec }) {
  const meshRef = useRef<Mesh>(null);
  /** Seconds since the last bounce pulse, or null when idle. */
  const pulse = useRef<number | null>(null);
  const band = biomeBandAt(spec.position[1]);
  const baseColor = useMemo(() => new Color(hex(BAND_COLOR[band] ?? palette.scenery.rock)), [band]);

  useFrame((_state, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const dt = Math.min(delta, 1 / 30);

    // Cosmetic contact pulse: when the blob is close + fast, fire a quick scale pop + emissive
    // flash. The REBOUND itself is resolved by Rapier (this collider is solid) — this is only the
    // juice. Fire at most one pulse per approach (re-arms once the blob leaves the contact shell).
    const diag = getBlobDiagnostics();
    const [bx, by, bz] = diag.position;
    const dx = bx - spec.position[0];
    const dy = by - spec.position[1];
    const dz = bz - spec.position[2];
    const d2 = dx * dx + dy * dy + dz * dz;
    const contactR = spec.radius + CONTACT_PAD;
    if (pulse.current === null && d2 <= contactR * contactR && diag.speed >= MIN_BOUNCE_SPEED) {
      pulse.current = 0;
      // A low thud scaled by impact speed + the bridge event (drained by HUD/vfx if they want it).
      playThump(Math.min(1, diag.speed / 28));
      reportObstacleBounce({ position: spec.position, speed: diag.speed });
    }

    const mat = mesh.material as MeshStandardMaterial;
    if (pulse.current !== null) {
      pulse.current += dt;
      const f = pulse.current / PULSE_LIFE;
      if (f >= 1) {
        pulse.current = null;
        mesh.scale.setScalar(1);
        mat.emissiveIntensity = 0;
      } else {
        const pop = Math.sin(f * Math.PI); // 0→1→0
        mesh.scale.setScalar(1 + pop * 0.22);
        mat.emissive.copy(baseColor);
        mat.emissiveIntensity = pop * 0.6;
      }
    }
  });

  return (
    <RigidBody
      type="fixed"
      colliders={false}
      position={spec.position}
      restitution={OBSTACLE_RESTITUTION}
      friction={0.4}
    >
      <BallCollider args={[spec.radius]} />
      <mesh ref={meshRef} castShadow>
        <icosahedronGeometry args={[spec.radius, 1]} />
        <meshStandardMaterial color={baseColor} roughness={0.85} metalness={0.05} flatShading />
      </mesh>
    </RigidBody>
  );
}

export function ObstacleField() {
  const obstacles = useWorldStore((s) => s.obstacles);
  const [centerY, setCenterY] = useState(0);
  const lastCenter = useRef(0);

  useFrame(() => {
    const y = getBlobDiagnostics().position[1];
    if (Math.abs(y - lastCenter.current) >= WINDOW_STEP) {
      lastCenter.current = y;
      setCenterY(y);
    }
  });

  const visible = useMemo(() => windowed(obstacles, centerY), [obstacles, centerY]);

  return (
    <>
      {visible.map((o) => (
        <ObstacleBody key={o.id} spec={o} />
      ))}
    </>
  );
}
