import { useFrame } from "@react-three/fiber";
import { BallCollider, type RapierRigidBody, RigidBody } from "@react-three/rapier";
import { useEffect, useRef } from "react";
import { playLaunch, playSplat } from "@/audio";
import { ImpactStyle, impact as impact_ } from "@/platform";
import { classifyExpression } from "@/sim/blob";
import { launchVelocity } from "@/sim/launch";
import { BLOB, DEATH_FALL_DISTANCE, MAX_IMPACT_SPEED, WORLD_BOUND_XZ } from "@/sim/physics";
import {
  consumeImpact,
  consumeLaunch,
  consumeRebound,
  getAirSteer,
  isPowerupActive,
  resetPowerups,
  setBlobDiagnostics,
  tickPowerups,
  useGameStore,
  useWorldStore,
} from "@/state";
import { GooField } from "./GooField";
import { useDroplets } from "./useDroplets";

/**
 * The PLAYABLE blob — a dynamic Rapier body wrapping the gooey visual. It reports its
 * height to the store (the core-goal readout), extends the tower as it climbs, applies
 * launch impulses + mid-air steering, and triggers game-over when it falls too far.
 *
 * Drives the blob's visual deformation/eyes through the diagnostics bridge (read by
 * BlobActor's own useFrame) rather than React state, so it never re-renders per frame.
 */

export function PlayerBlob() {
  const bodyRef = useRef<RapierRigidBody>(null);
  const skin = useGameStore((s) => s.progress.skin);
  const setRun = useGameStore((s) => s.setRun);
  const setPhase = useGameStore((s) => s.setPhase);
  const commitBestHeight = useGameStore((s) => s.commitBestHeight);
  const ensureHeight = useWorldStore((s) => s.ensureHeight);
  const { splash, launchBurst, trail, reset: resetDroplets, get: getDroplets } = useDroplets();
  const maxY = useRef(0);
  const lastEnsureY = useRef(0);
  const dead = useRef(false);
  /** Recent impact amount [0,1], set on landing and decaying each frame. */
  const impact = useRef(0);

  // Reset body to the starter pad whenever a run begins. PlayerBlob remounts on each
  // run (GameScene mounts <Physics> only while playing), so [] is correct; the refs
  // below also re-init here for safety if it ever stays mounted across runs.
  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    body.setTranslation({ x: 0, y: 3, z: 0 }, true);
    body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    maxY.current = 3;
    lastEnsureY.current = 3;
    dead.current = false;
    resetPowerups();
    resetDroplets();
    impact.current = 0;
  }, [resetDroplets]);

  useFrame((_, dt) => {
    const body = bodyRef.current;
    if (!body) return;
    const p = body.translation();
    const v = body.linvel();
    const airborne = Math.abs(v.y) > 0.5;

    // Power-up timers tick down; the hyper-thrust holds a strong upward velocity while
    // active (smashing the blob skyward), overriding gravity for its duration.
    tickPowerups(dt);
    if (isPowerupActive("thruster")) {
      body.wakeUp();
      body.setLinvel({ x: v.x, y: 34, z: v.z }, true);
    }

    // Trampoline auto-bounce: landing on a pad pops the blob back up (the springy core
    // of "trampolines") and builds the clean-bounce combo. A charged slingshot drag adds
    // extra power on top via consumeLaunch below.
    const bounce = consumeRebound();
    if (bounce) {
      body.wakeUp();
      body.setLinvel({ x: v.x, y: bounce.speed, z: v.z }, true);
      const run = useGameStore.getState().run;
      setRun({ combo: run.combo + 1 });
    }

    // Launch: set velocity directly for a crisp, predictable pop.
    const req = consumeLaunch();
    if (req) {
      const lv = launchVelocity(req.dir, req.charge, "standard", useGameStore.getState().run.combo);
      body.wakeUp();
      body.setLinvel({ x: lv[0], y: lv[1], z: lv[2] }, true);
      playLaunch(req.charge);
      // Kick a downward goo burst off the pad as the blob pops.
      launchBurst([p.x, p.y - BLOB.radius, p.z], req.charge);
    } else if (airborne) {
      // Mid-air steering: nudge lateral velocity on the X/Z plane (PoC air control).
      const [sx, sz] = getAirSteer();
      if (sx !== 0 || sz !== 0) {
        body.setLinvel({ x: v.x + sx * dt, y: v.y, z: v.z + sz * dt }, true);
      }
    }

    // Wet goo trail: while flying fast, shed a lagging droplet wake behind the blob.
    // Distance-throttled inside useDroplets so the spacing is frame-rate independent.
    const speed = Math.hypot(v.x, v.y, v.z);
    if (airborne && speed > 6) {
      const inv = 1 / speed;
      trail([p.x, p.y, p.z], [v.x * inv, v.y * inv, v.z * inv], speed);
    }

    // Keep the blob inside the lateral play bounds.
    if (Math.abs(p.x) > WORLD_BOUND_XZ || Math.abs(p.z) > WORLD_BOUND_XZ) {
      body.setLinvel({ x: -v.x * 0.5, y: v.y, z: -v.z * 0.5 }, true);
    }

    // Height-chase readout + tower extension. Throttle generation to every ~10m so the
    // RNG/world build doesn't run inside the frame loop on every ascent frame (mobile).
    if (p.y > maxY.current) {
      maxY.current = p.y;
      setRun({ height: p.y });
      if (p.y - lastEnsureY.current > 10) {
        lastEnsureY.current = p.y;
        ensureHeight(p.y + 180);
      }
    }

    // Landings (reported by a trampoline sensor) spike impact; it decays each frame and
    // drives the squint eyes + squash. Normalized against MAX_IMPACT_SPEED.
    const landed = consumeImpact();
    if (landed > 0) {
      const strength = Math.min(1, landed / MAX_IMPACT_SPEED);
      impact.current = strength;
      // Fling a gooey splash from the contact point (just under the blob).
      splash([p.x, p.y - BLOB.radius, p.z], strength);
      // Haptic thump on landing (mobile), scaled to impact; respects the setting.
      if (useGameStore.getState().settings.haptics) {
        impact_(
          strength > 0.6
            ? ImpactStyle.Heavy
            : strength > 0.3
              ? ImpactStyle.Medium
              : ImpactStyle.Light,
        );
      }
    }
    impact.current = Math.max(0, impact.current - dt * 2.5);
    const fallDepth = maxY.current - p.y;
    const expr = classifyExpression({ vy: v.y, impact: impact.current, fallDepth, airborne });

    // Visual state for BlobActor (read via the bridge — no per-frame React render).
    setBlobDiagnostics({
      position: [p.x, p.y, p.z],
      velocity: [v.x, v.y, v.z],
      speed,
      airborne,
      expression: expr,
      squash: 1 - impact.current * 0.3,
      maxHeight: maxY.current,
    });

    // Death: fire exactly once (guard against firing every frame while still falling).
    if (!dead.current && fallDepth > DEATH_FALL_DISTANCE) {
      dead.current = true;
      playSplat();
      commitBestHeight(maxY.current);
      setPhase("gameover");
    }
  });

  return (
    <>
      <RigidBody
        ref={bodyRef}
        colliders={false}
        position={[0, 3, 0]}
        linearDamping={BLOB.linearDamping}
        friction={BLOB.friction}
        restitution={BLOB.restitution}
        ccd={BLOB.ccd}
        canSleep={false}
        enabledRotations={[false, false, false]}
      >
        <BallCollider args={[BLOB.radius]} />
      </RigidBody>
      {/* Goo skin lives in world space (follows the blob via the diagnostics bridge),
          NOT as a physics child — it merges the blob with the live splash droplets. */}
      <GooField skin={skin} blobRadius={BLOB.radius} getDroplets={getDroplets} />
    </>
  );
}
