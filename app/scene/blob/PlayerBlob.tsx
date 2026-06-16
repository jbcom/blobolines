import { useFrame } from "@react-three/fiber";
import { BallCollider, type RapierRigidBody, RigidBody } from "@react-three/rapier";
import type { Entity } from "koota";
import { useWorld } from "koota/react";
import { useEffect, useRef } from "react";
import { playLaunch, playSplat, setMusicAltitude } from "@/audio";
import { Blob, Transform, Velocity } from "@/ecs";
import { spawnBlob } from "@/factories";
import { ImpactStyle, impact as impact_, vibrate } from "@/platform";
import { blobTraitsFromSnapshot, classifyExpression } from "@/sim/blob";
import { MAX_COMBO } from "@/sim/combo";
import { launchVelocity } from "@/sim/launch";
import { BLOB, DEATH_FALL_DISTANCE, MAX_IMPACT_SPEED, WORLD_BOUND_XZ } from "@/sim/physics";
import {
  consumeImpact,
  consumeLaunch,
  consumeRebound,
  flash,
  getAirSteer,
  isPowerupActive,
  reportSplat,
  resetBridges,
  resetFlash,
  resetPowerups,
  setBlobDiagnostics,
  tickPowerups,
  useGameStore,
  useWorldStore,
} from "@/state";
import { GooCsg } from "./GooCsg";
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
  const world = useWorld();
  /** The blob's ECS entity — its logical source of truth (Rapier owns the dynamics; this
   *  is the queryable projection synced each step). Spawned via the factory on mount. */
  const entityRef = useRef<Entity | null>(null);
  const skin = useGameStore((s) => s.progress.skin);
  const setRun = useGameStore((s) => s.setRun);
  const setPhase = useGameStore((s) => s.setPhase);
  const commitBestHeight = useGameStore((s) => s.commitBestHeight);
  const ensureHeight = useWorldStore((s) => s.ensureHeight);
  const { splash, launchBurst, trail, reset: resetDroplets, get: getDroplets } = useDroplets();
  const maxY = useRef(0);
  /** Highest pad the blob has actually landed on — death is measured below THIS, not the
   *  airborne apex (a tall launch arcs >DEATH_FALL_DISTANCE above its own pad and would
   *  otherwise self-destruct on the way back down to the very pad it left). */
  const safeY = useRef(0);
  const lastEnsureY = useRef(0);
  const dead = useRef(false);
  /** Recent impact amount [0,1], set on landing and decaying each frame. */
  const impact = useRef(0);
  /** Countdown to the next near-death heartbeat haptic (shrinks as death nears). */
  const dangerBeat = useRef(0);

  // Spawn the blob ECS entity for this run; destroy it on unmount (PlayerBlob remounts per
  // run). The entity is the blob's queryable logical state, synced from Rapier each step.
  useEffect(() => {
    const entity = spawnBlob(world, BLOB.radius);
    entityRef.current = entity;
    return () => {
      entity.destroy();
      entityRef.current = null;
    };
  }, [world]);

  // Reset body to the starter pad whenever a run begins. PlayerBlob remounts on each
  // run (GameScene mounts <Physics> only while playing), so [] is correct; the refs
  // below also re-init here for safety if it ever stays mounted across runs.
  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    body.setTranslation({ x: 0, y: 3, z: 0 }, true);
    body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    maxY.current = 3;
    safeY.current = 3;
    lastEnsureY.current = 3;
    dead.current = false;
    resetPowerups();
    resetDroplets();
    resetBridges(); // clear any launch/aim/rebound/splat left pending from the prior run
    resetFlash(); // no leftover combo/launch/death flash crossing into the new run
    impact.current = 0;
    dangerBeat.current = 0;
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
      // Launch ALONG the pad's surface normal: a flat pad bounces straight up (keeps the
      // blob's horizontal drift); a canted pad's tilted normal throws the blob sideways-
      // and-up toward the next pad. Blend horizontal momentum with the normal's lateral
      // component so canted pads redirect without fully killing existing drift.
      const n = bounce.normal;
      if (n && (n[0] !== 0 || n[2] !== 0)) {
        body.setLinvel(
          {
            x: v.x * 0.3 + n[0] * bounce.speed,
            y: n[1] * bounce.speed,
            z: v.z * 0.3 + n[2] * bounce.speed,
          },
          true,
        );
      } else {
        body.setLinvel({ x: v.x, y: bounce.speed, z: v.z }, true);
      }
      const run = useGameStore.getState().run;
      // Ice pads are slippery: a big bouncy launch but it BREAKS the clean-combo streak
      // (risk/reward). Every other pad builds the combo, capped at MAX_COMBO (the launch
      // multiplier is balanced around that cap; leaving it unclamped overshot).
      const nextCombo = bounce.type === "ice" ? 0 : Math.min(run.combo + 1, MAX_COMBO);
      setRun({ combo: nextCombo, maxCombo: Math.max(run.maxCombo, nextCombo) });
      // Gold screen flash as the streak escalates (from 3×), intensity ramping with heat.
      if (nextCombo >= 3) flash("gold", Math.min(1, (nextCombo - 2) / 6));
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
      // Blue flash on a big charged launch (the bigger the charge, the brighter the pop).
      if (req.charge > 0.6) flash("blue", req.charge);
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
        setMusicAltitude(p.y); // shift the ambient bed with altitude (throttled to ~10m)
      }
    }

    // Landings (reported by a trampoline sensor) spike impact; it decays each frame and
    // drives the squint eyes + squash. Normalized against MAX_IMPACT_SPEED.
    const landed = consumeImpact();
    if (landed > 0) {
      const strength = Math.min(1, landed / MAX_IMPACT_SPEED);
      impact.current = strength;
      // This pad is now the safe floor — death is measured below the highest pad reached,
      // so a tall launch can fall back past DEATH_FALL_DISTANCE of its own apex and live.
      if (p.y > safeY.current) safeY.current = p.y;
      // Fling a gooey splash from the contact point (just under the blob).
      splash([p.x, p.y - BLOB.radius, p.z], strength);
      // On a meaningful impact, also fling REAL physics goo chunks that bounce/roll/settle
      // on the pad (the kinematic splash above is the metaball merge; this is the physical
      // mess). Gated so micro-bounces don't spawn bodies.
      if (strength > 0.25) reportSplat({ position: [p.x, p.y - BLOB.radius, p.z], strength });
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
    // Death is fall below the highest pad LANDED on (safeY), not the airborne apex (maxY) —
    // otherwise a big launch kills itself on the way back down to its own pad.
    const fallDepth = safeY.current - p.y;
    const expr = classifyExpression({ vy: v.y, impact: impact.current, fallDepth, airborne });

    // Near-death danger: as the blob falls past half the death distance, pulse a red edge
    // vignette that intensifies toward the fatal depth (a clear "you're about to die" cue),
    // plus an escalating heartbeat haptic whose interval shrinks as death nears.
    if (fallDepth > DEATH_FALL_DISTANCE * 0.5) {
      const danger = (fallDepth - DEATH_FALL_DISTANCE * 0.5) / (DEATH_FALL_DISTANCE * 0.5);
      flash("red", danger);
      // Heartbeat: interval 0.45s → 0.12s as danger ramps 0→1; fire a short buzz each beat.
      dangerBeat.current -= dt;
      if (dangerBeat.current <= 0) {
        dangerBeat.current = 0.45 - danger * 0.33;
        // Respect the haptics setting (matches the landing-impact gate above).
        if (useGameStore.getState().settings.haptics) void vibrate(12 + Math.round(danger * 20));
      }
    } else {
      dangerBeat.current = 0;
    }

    // Visual state for BlobActor (read via the bridge — no per-frame React render).
    const squash = 1 - impact.current * 0.3;
    setBlobDiagnostics({
      position: [p.x, p.y, p.z],
      velocity: [v.x, v.y, v.z],
      speed,
      airborne,
      expression: expr,
      squash,
      maxHeight: maxY.current,
      groundY: safeY.current,
    });

    // Project the Rapier-driven state onto the blob's ECS entity so systems + UI can query
    // it without reaching into the renderer (Rapier stays the dynamics authority).
    const entity = entityRef.current;
    if (entity?.isAlive()) {
      const u = blobTraitsFromSnapshot({
        position: [p.x, p.y, p.z],
        velocity: [v.x, v.y, v.z],
        squash,
        airborne,
        expression: expr,
      });
      entity.set(Transform, u.transform);
      entity.set(Velocity, u.velocity);
      entity.set(Blob, u.blob);
    }

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
          NOT as a physics child — it merges the blob with the live splash droplets into
          one continuous CSG mesh (real goo, not a ball). */}
      <GooCsg skin={skin} blobRadius={BLOB.radius} getDroplets={getDroplets} />
    </>
  );
}
