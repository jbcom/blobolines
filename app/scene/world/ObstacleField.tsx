import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { BallCollider, type RapierRigidBody, RigidBody } from "@react-three/rapier";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Color, type Group, type Mesh, type Object3D } from "three";
import { playThump } from "@/audio";
import { biomeBandAt } from "@/config";
import { getBlobDiagnostics, reportObstacleBounce, useGameStore, useWorldStore } from "@/state";
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

/** Per-band obstacle tint for the procedural fallback, so an obstacle reads as belonging to its
 *  biome (warm rock low, icy crystal mid, dark asteroid in space). Keyed by the canonical band. */
const BAND_COLOR: Record<string, string> = {
  ground: palette.scenery.rock,
  sky: palette.scenery.rock,
  "upper-atmosphere": palette.tramp.ice,
  stratosphere: palette.tramp.violet,
  space: palette.scenery.asteroid,
  "deep-space": palette.scenery.asteroid,
};

/** Per-band obstacle GLB — a SOLID rounded prop from the band's own asset set (reusing the vetted
 *  biome GLBs, so obstacles read coherent with the decorative scenery and no new assets are added).
 *  The procedural icosahedron is the Suspense fallback so an obstacle never blanks while streaming. */
const BAND_MODEL: Record<string, string> = {
  ground: "biomes/ground/desert-rock.glb",
  sky: "biomes/sky/round-pine.glb",
  "upper-atmosphere": "biomes/upper-atmosphere/snowy-rock.glb",
  stratosphere: "biomes/stratosphere/mushroom-giant.glb",
  space: "biomes/space/asteroid-large.glb",
  "deep-space": "biomes/deep-space/alien-crystal-rock.glb",
};

const modelUrl = (file: string) => `${import.meta.env.BASE_URL}assets/models/${file}`;

/** The band's GLB obstacle prop, scaled to roughly fill the collider radius. Clones the cached scene
 *  so each instance is independent, and DISPOSES the cloned geometries on unmount (band crossings
 *  unmount these often as the render window scrolls) — scene.clone(true) makes fresh geometry
 *  instances; their materials are SHARED with the useGLTF cache, so only the geometries are disposed
 *  (matching BiomeScenicProps' cleanup discipline). */
function ObstacleModel({ band, radius }: { band: string; radius: number }) {
  // No silent fallback (project doctrine): every band MUST have a model, or surface it loudly.
  const file = BAND_MODEL[band];
  if (!file) throw new Error(`No obstacle model configured for biome band "${band}"`);
  const { scene } = useGLTF(modelUrl(file));
  const [model, setModel] = useState<Object3D | null>(null);
  useEffect(() => {
    const clone = scene.clone(true);
    setModel(clone);
    return () => {
      clone.traverse((o) => {
        const mesh = o as Mesh;
        if (mesh.isMesh) mesh.geometry?.dispose();
      });
    };
  }, [scene]);
  if (!model) return null;
  // The source props vary in native size; a uniform scale tied to the radius reads as a boulder of
  // about the collider's size. (Exact silhouette differs per prop — that's the point: variety.)
  return <primitive object={model} scale={radius * 1.15} />;
}

function ObstacleBody({ spec }: { spec: ObstacleSpec }) {
  const bodyRef = useRef<RapierRigidBody>(null);
  const visualRef = useRef<Group>(null);
  /** Accumulated bob clock (seeded at the spec phase). Advanced by dt only while PLAYING — so the
   *  bob FREEZES on pause (matching the frozen sim) and never teleports on resume / after a
   *  backgrounded-tab clock jump (which using state.clock.elapsedTime directly would cause). */
  const bobTime = useRef(spec.bob.phase);
  /** Seconds since the last bounce pulse, or null when idle. */
  const pulse = useRef<number | null>(null);
  /** Whether the blob is currently inside the contact shell — the bounce fires ONCE on ENTRY and
   *  only re-arms after the blob has LEFT the shell, so lingering/sliding inside it can't re-trigger
   *  the thump + event every PULSE_LIFE. */
  const insideContact = useRef(false);
  const band = biomeBandAt(spec.position[1]);
  // No silent fallback (project doctrine): every band MUST be configured, or surface it loudly.
  const colorHex = BAND_COLOR[band];
  if (!colorHex) throw new Error(`No obstacle color configured for biome band "${band}"`);
  const baseColor = useMemo(() => new Color(hex(colorHex)), [colorHex]);
  const [cx, cy, cz] = spec.position;

  useFrame((_state, delta) => {
    const visual = visualRef.current;
    if (!visual) return;
    const dt = Math.min(delta, 1 / 30);

    // VERTICAL BOB: the obstacle drifts up/down a small amount around its rest center. Driven on the
    // KINEMATIC body so Rapier resolves the bounce against the moving collider (a fixed body wouldn't
    // impart the bob). The bob travel was verified clear of the route at generation, so this can never
    // intrude on the climb. Time is ACCUMULATED via dt only while playing (not the raw render clock),
    // so the bob freezes on pause + never teleports on resume / after a backgrounded-tab clock jump.
    if (useGameStore.getState().phase === "playing") bobTime.current += dt * spec.bob.speed;
    const obsY = cy + Math.sin(bobTime.current) * spec.bob.amplitude;
    bodyRef.current?.setNextKinematicTranslation({ x: cx, y: obsY, z: cz });

    // Cosmetic contact pulse: when the blob ENTERS the shell fast, fire a quick scale POP on the
    // visual. The REBOUND itself is resolved by Rapier (this collider is solid) — this is the juice.
    // Latched on entry: it fires once and only re-arms once the blob has left the shell, so a body
    // that lingers/slides inside it doesn't machine-gun the thump + event.
    const diag = getBlobDiagnostics();
    const [bx, by, bz] = diag.position;
    const dx = bx - cx;
    const dy = by - obsY;
    const dz = bz - cz;
    const d2 = dx * dx + dy * dy + dz * dz;
    const contactR = spec.radius + CONTACT_PAD;
    const isInside = d2 <= contactR * contactR;
    if (!isInside) {
      insideContact.current = false; // left the shell — re-arm
    } else if (!insideContact.current && diag.speed >= MIN_BOUNCE_SPEED) {
      insideContact.current = true;
      pulse.current = 0;
      // A low thud scaled by impact speed + the bridge event (drained by HUD/vfx if they want it).
      playThump(Math.min(1, diag.speed / 28));
      reportObstacleBounce({ position: [cx, obsY, cz], speed: diag.speed });
    }

    if (pulse.current !== null) {
      pulse.current += dt;
      const f = pulse.current / PULSE_LIFE;
      if (f >= 1) {
        pulse.current = null;
        visual.scale.setScalar(1);
      } else {
        const pop = Math.sin(f * Math.PI); // 0→1→0
        visual.scale.setScalar(1 + pop * 0.22);
      }
    }
  });

  return (
    <RigidBody
      ref={bodyRef}
      type="kinematicPosition"
      colliders={false}
      position={spec.position}
      restitution={OBSTACLE_RESTITUTION}
      friction={0.4}
    >
      <BallCollider args={[spec.radius]} />
      {/* The visual (GLB prop from the band's asset set, or the procedural fallback while it streams)
          lives under a group the pulse scales. Rotated by a fixed per-instance angle for variety. */}
      <group ref={visualRef} rotation={[0, spec.id % 6, 0]}>
        <Suspense
          fallback={
            <mesh castShadow>
              <icosahedronGeometry args={[spec.radius, 1]} />
              <meshStandardMaterial
                color={baseColor}
                roughness={0.85}
                metalness={0.05}
                flatShading
              />
            </mesh>
          }
        >
          <ObstacleModel band={band} radius={spec.radius} />
        </Suspense>
      </group>
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

// Preload every band's obstacle GLB for stutter-free band transitions (skipped under vitest).
if (!import.meta.env.VITEST) {
  for (const file of Object.values(BAND_MODEL)) {
    useGLTF.preload(modelUrl(file));
  }
}
