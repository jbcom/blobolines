import { useFrame } from "@react-three/fiber";
import { BallCollider, type RapierRigidBody, RigidBody } from "@react-three/rapier";
import { useEffect, useRef } from "react";
import {
  duckMusic,
  playComboBlip,
  playComboFanfare,
  playDeath,
  playLaunch,
  playPowerdown,
  playPowerup,
  playSplat,
  playThump,
  setMusicAltitude,
} from "@/audio";
import { blob } from "@/config";
import { ImpactStyle, impact as impact_, vibrate } from "@/platform";
import { classifyExpression, stepIdlePatience } from "@/sim/blob";
import { MAX_COMBO } from "@/sim/combo";
import { downdraftAt, windAt } from "@/sim/hazard";
import { isPerfectRelease, launchVelocity } from "@/sim/launch";
import {
  BLOB,
  DEATH_FALL_DISTANCE,
  MAX_IMPACT_SPEED,
  runHeightFromWorldY,
  STARTER_BLOB_Y,
  WORLD_BOUND_XZ,
} from "@/sim/physics";
import { goldenPathLandingBonus, goldenPathLandingQuality } from "@/sim/score";
import {
  consumeBounceCharge,
  consumeCloudAdherence,
  consumeImpact,
  consumeLanding,
  consumeLaunch,
  consumeMidAirBounce,
  consumeRouteGateHit,
  consumeShield,
  flash,
  getAim,
  getAirSteer,
  isPowerupActive,
  isRouteProofSequenceActive,
  reportBlobSplit,
  reportLaunchBurst,
  reportRouteLandingFeedback,
  reportSplat,
  resetBridges,
  resetFlash,
  resetPowerups,
  resetViewControls,
  setBlobDiagnostics,
  tickPowerups,
  timeScale,
  useGameStore,
  useWorldStore,
} from "@/state";
import { FreeDroplets } from "./FreeDroplets";
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
  const skin = useGameStore((s) => s.progress.skin);
  const setRun = useGameStore((s) => s.setRun);
  const setPhase = useGameStore((s) => s.setPhase);
  const commitBestHeight = useGameStore((s) => s.commitBestHeight);
  const ensureHeight = useWorldStore((s) => s.ensureHeight);
  const { splash, launchBurst, trail, reset: resetDroplets, get: getDroplets } = useDroplets();
  const maxY = useRef(0);
  /** Last blob Y seen, to detect descending pad-level crossings for the near-miss whoosh. */
  const prevY = useRef(0);
  /** Pad ids we've already whooshed past, so one near-miss fires at most once per pad. */
  const nearMissed = useRef<Set<number>>(new Set());
  /** Last cloud Blobby caught and settled into — death is measured below THIS, not the airborne
   *  apex. Falling back into a lower cloud is a valid recovery, so this can move down; maxY still
   *  tracks the high-water mark for score and altitude. */
  const safeY = useRef(0);
  const lastEnsureY = useRef(0);
  const dead = useRef(false);
  /** Recent impact amount [0,1], set on landing and decaying each frame. */
  const impact = useRef(0);
  /** Countdown to the next near-death heartbeat haptic (shrinks as death nears). */
  const dangerBeat = useRef(0);
  /** Seconds the blob has rested idle (not airborne, not being aimed). Drives only expression
   *  impatience; launch remains entirely player-controlled. */
  const idle = useRef(0);
  /** Recent happy energy from a strong/accurate catch; drives idle burble + face. */
  const excitement = useRef(0);
  /** Recent soft-cloud adhesion. It decays unless the cloud field refreshes it this frame,
   *  giving the renderer a clear "coating/clinging to a cloud" envelope. */
  const cloudCling = useRef({
    padId: -1,
    type: "standard",
    position: [0, STARTER_BLOB_Y, 0] as [number, number, number],
    relX: 0,
    relZ: 0,
    strength: 0,
  });
  /** Combo is a skill reward, not attract-mode scoring: only build it after the player has
   *  launched, air-steered, or spent a mid-air bounce in the current run. */
  const playerControlStarted = useRef(false);
  /** Bubble duration timer in seconds. Active > 0. */
  const bubbleRemaining = useRef(0);

  // Reset body to the starter pad whenever a run begins. PlayerBlob remounts on each
  // run (GameScene mounts <Physics> only while playing), so [] is correct; the refs
  // below also re-init here for safety if it ever stays mounted across runs.
  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    body.setTranslation({ x: 0, y: STARTER_BLOB_Y, z: 0 }, true);
    body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    maxY.current = STARTER_BLOB_Y;
    safeY.current = STARTER_BLOB_Y;
    prevY.current = STARTER_BLOB_Y;
    nearMissed.current.clear();
    lastEnsureY.current = STARTER_BLOB_Y;
    dead.current = false;
    resetPowerups();
    resetViewControls();
    resetDroplets();
    resetBridges(); // clear any launch/aim/cloud/splat left pending from the prior run
    resetFlash(); // no leftover combo/launch/death flash crossing into the new run
    impact.current = 0;
    dangerBeat.current = 0;
    idle.current = 0;
    excitement.current = 0;
    cloudCling.current.strength = 0;
    playerControlStarted.current = false;
    bubbleRemaining.current = 0;
    setBlobDiagnostics({
      position: [0, STARTER_BLOB_Y, 0],
      velocity: [0, 0, 0],
      speed: 0,
      airborne: false,
      expression: "idle",
      squash: 1,
      maxHeight: 0,
      groundY: STARTER_BLOB_Y,
      idleSeconds: 0,
      excitement: 0,
    });
  }, [resetDroplets]);

  const stepPowerups = (realDt: number, body: RapierRigidBody) => {
    if (tickPowerups(realDt).length > 0) playPowerdown();
    if (isPowerupActive("thruster")) {
      body.wakeUp();
      const liveV = body.linvel();
      body.setLinvel({ x: liveV.x, y: blob.thrusterVelocity, z: liveV.z }, true);
    }
  };

  const stepHazards = (
    p: { x: number; y: number; z: number },
    dt: number,
    time: number,
    body: RapierRigidBody,
  ) => {
    let [sx, sz] = getAirSteer();
    if (bubbleRemaining.current > 0) {
      sx *= 2.5;
      sz *= 2.5;
    }
    if (sx !== 0 || sz !== 0) playerControlStarted.current = true;
    const [wx, wz] = windAt(p.y, time);
    const down = downdraftAt(p.y, time);
    const liveV = body.linvel();
    if (sx !== 0 || sz !== 0 || wx !== 0 || wz !== 0 || down !== 0) {
      body.setLinvel(
        { x: liveV.x + (sx + wx) * dt, y: liveV.y - down * dt, z: liveV.z + (sz + wz) * dt },
        true,
      );
    }
    if (Math.abs(p.x) > WORLD_BOUND_XZ || Math.abs(p.z) > WORLD_BOUND_XZ) {
      const updatedV = body.linvel();
      body.setLinvel({ x: -updatedV.x * 0.5, y: updatedV.y, z: -updatedV.z * 0.5 }, true);
    }
  };

  const stepVortexAttraction = (
    p: { x: number; y: number; z: number },
    dt: number,
    body: RapierRigidBody,
  ) => {
    const liveV = body.linvel();
    if (liveV.y >= 0) return;

    const pads = useWorldStore.getState().trampolines;
    const influenceRadius = 8.5;
    const verticalLimit = 12.0;

    for (const pad of pads) {
      if (pad.type !== "vortex") continue;

      const dx = pad.position[0] - p.x;
      const dz = pad.position[2] - p.z;
      const dist = Math.hypot(dx, dz);
      const dy = Math.abs(p.y - pad.position[1]);

      if (dist < influenceRadius && dy < verticalLimit && dist > 0.1) {
        const k = 1.0 - dist / influenceRadius;
        const inwardStrength = 14.0;
        const swirlStrength = 6.0;

        const forceX = ((dx / dist) * inwardStrength + (-dz / dist) * swirlStrength) * k * dt;
        const forceZ = ((dz / dist) * inwardStrength + (dx / dist) * swirlStrength) * k * dt;

        body.setLinvel({ x: liveV.x + forceX, y: liveV.y, z: liveV.z + forceZ }, true);
        break;
      }
    }
  };

  const stepNearMisses = (
    p: { x: number; y: number; z: number },
    v: { x: number; y: number; z: number },
  ) => {
    if (v.y < blob.nearMiss.speedThreshold) {
      const pads = useWorldStore.getState().trampolines;
      for (const pad of pads) {
        if (nearMissed.current.has(pad.id)) continue;
        const padTop = pad.position[1] + 0.5;
        if (prevY.current <= padTop || p.y > padTop) continue;
        const dx = p.x - pad.position[0];
        const dz = p.z - pad.position[2];
        const lateral = Math.hypot(dx, dz);
        const half = Math.max(pad.width, pad.depth) * 0.5;
        if (
          lateral > half + blob.nearMiss.minDistance &&
          lateral < half + blob.nearMiss.maxDistance
        ) {
          nearMissed.current.add(pad.id);
          playLaunch(blob.nearMiss.soundVolume);
        }
      }
      if (nearMissed.current.size > 64 && pads.length > 0) {
        const lowest = pads[0].id;
        for (const id of nearMissed.current) if (id < lowest) nearMissed.current.delete(id);
      }
    }
    prevY.current = p.y;
  };

  const stepLandings = (p: { x: number; y: number; z: number }) => {
    const landed = consumeImpact();
    if (landed > 0) {
      const strength = Math.min(1, landed / MAX_IMPACT_SPEED);
      impact.current = strength;
      safeY.current = p.y;
      let routeQuality = 0;
      const landing = consumeLanding();
      if (landing) {
        const pads = useWorldStore.getState().trampolines;
        const source = pads.find((pad) => pad.goldenPath?.toPadId === landing.padId);
        const targetPad = pads.find((pad) => pad.id === landing.padId);
        const proof = source?.goldenPath;
        const run = useGameStore.getState().run;
        const nextCombo =
          !playerControlStarted.current || targetPad?.type === "ice"
            ? 0
            : Math.min(run.combo + 1, MAX_COMBO);
        setRun({ combo: nextCombo, maxCombo: Math.max(run.maxCombo, nextCombo) });

        if (targetPad && targetPad.type === "bubble") {
          bubbleRemaining.current = 3.5;
          playPowerup();
          flash("blue", 0.8);
        } else if (bubbleRemaining.current > 0) {
          bubbleRemaining.current = 0;
          splash([p.x, p.y - BLOB.radius, p.z], 0.8);
          playSplat();
          flash("blue", 0.5);
        }
        if (nextCombo > 0) {
          playComboBlip(nextCombo);
          if (nextCombo >= MAX_COMBO && run.combo < MAX_COMBO) {
            playComboFanfare();
            duckMusic(600);
          }
          if (nextCombo >= 3) flash("gold", Math.min(1, (nextCombo - 2) / 6));
        }
        if (proof && targetPad) {
          const miss = Math.hypot(
            landing.position[0] - proof.landing[0],
            landing.position[2] - proof.landing[2],
          );
          const halfFoot = Math.max(targetPad.width, targetPad.depth) * 0.5;
          routeQuality = goldenPathLandingQuality(miss, halfFoot);
          const bonus = goldenPathLandingBonus(miss, halfFoot);
          reportRouteLandingFeedback({
            quality: routeQuality,
            bonus,
            miss,
            halfFootprint: halfFoot,
            sourceMode: proof.sourceMode,
            targetType: targetPad.type,
          });
          if (bonus > 0) {
            const scoredRun = useGameStore.getState().run;
            setRun({ stylePoints: scoredRun.stylePoints + bonus });
          }
          if (routeQuality > 0.72) flash("gold", Math.min(1, routeQuality));
        }
      }
      excitement.current = Math.max(excitement.current, strength, 0.25 + routeQuality * 0.75);
      splash([p.x, p.y - BLOB.radius, p.z], strength);
      playThump(strength);
      if (strength > 0.2) {
        reportLaunchBurst({
          position: [p.x, p.y - BLOB.radius, p.z],
          charge: strength,
          kind: "land",
        });
      }
      if (strength > 0.25) reportSplat({ position: [p.x, p.y - BLOB.radius, p.z], strength });
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
  };

  useFrame((state, rawDt) => {
    const body = bodyRef.current;
    if (!body) return;
    const realDt = Math.min(rawDt, 0.1);
    const dt = realDt * timeScale();
    let p = body.translation();
    let v = body.linvel();
    let airborne = Math.abs(v.y) > 0.5;

    if (bubbleRemaining.current > 0) {
      bubbleRemaining.current -= dt;
      body.setGravityScale(0.2, true);
      if (bubbleRemaining.current <= 0) {
        body.setGravityScale(1.0, true);
        splash([p.x, p.y - BLOB.radius, p.z], 0.8);
        playSplat();
        flash("blue", 0.5);
      }
    } else {
      body.setGravityScale(1.0, true);
    }

    stepPowerups(realDt, body);

    if (consumeMidAirBounce() && consumeBounceCharge()) {
      playerControlStarted.current = true;
      body.wakeUp();
      body.setLinvel({ x: v.x, y: blob.midAirBounceVelocity, z: v.z }, true);
      launchBurst([p.x, p.y - BLOB.radius, p.z], 0.6);
      reportLaunchBurst({ position: [p.x, p.y - BLOB.radius, p.z], charge: 0.6, kind: "launch" });
      flash("blue", 0.6);
      playLaunch(0.6);
    }

    const gateHit = consumeRouteGateHit();
    if (gateHit) {
      if (bubbleRemaining.current > 0) {
        bubbleRemaining.current = 0;
        body.setGravityScale(1.0, true);
        splash([p.x, p.y - BLOB.radius, p.z], 0.8);
        playSplat();
      }
      playerControlStarted.current = true;
      body.wakeUp();
      const live = body.linvel();
      if (gateHit.kind === "slicer") {
        reportBlobSplit({
          position: gateHit.position,
          velocity: [live.x, live.y, live.z],
          normal: gateHit.normal,
          count: gateHit.fragmentCount ?? 3,
          spread: gateHit.splitSpread ?? 3,
          strength: gateHit.strength,
          fragmentLanes: gateHit.fragmentLanes,
        });
        const survivor = gateHit.fragmentLanes?.find((lane) => lane.survivor);
        if (survivor) {
          const [x, y, z] = survivor.exitVelocity;
          body.setLinvel({ x, y, z }, true);
        } else {
          body.setLinvel({ x: live.x * 0.9, y: live.y * 0.88, z: live.z * 0.9 }, true);
        }
        impact.current = Math.max(impact.current, 0.38 * gateHit.strength);
        excitement.current = Math.max(excitement.current, 0.65);
        flash("gold", Math.min(1, gateHit.strength));
        reportSplat({ position: gateHit.position, strength: Math.min(0.7, gateHit.strength) });
        playLaunch(0.45);
      } else {
        body.setLinvel(
          {
            x: -live.x * 0.28,
            y: Math.min(live.y * 0.25, 0),
            z: -live.z * 0.28,
          },
          true,
        );
        impact.current = Math.max(impact.current, 0.7 * gateHit.strength);
        excitement.current = Math.max(excitement.current, 0.2);
        flash("red", Math.min(1, gateHit.strength));
        reportSplat({ position: gateHit.position, strength: Math.min(1, gateHit.strength) });
        playThump(Math.min(1, gateHit.strength));
        playSplat();
      }
    }

    const adherence = consumeCloudAdherence();
    if (adherence) {
      body.wakeUp();
      const live = body.linvel();
      const pos = body.translation();
      const k = Math.min(0.55, 0.18 + adherence.strength * 0.34);
      const settleY = pos.y + (adherence.settleY - pos.y) * k;
      body.setTranslation(
        {
          x: pos.x + (adherence.position[0] - pos.x) * 0.018 * adherence.strength,
          y: settleY,
          z: pos.z + (adherence.position[2] - pos.z) * 0.018 * adherence.strength,
        },
        true,
      );
      body.setLinvel(
        {
          x: live.x * (1 - 0.34 * adherence.strength),
          y: live.y > 1.5 ? live.y : live.y * (1 - 0.82 * adherence.strength),
          z: live.z * (1 - 0.34 * adherence.strength),
        },
        true,
      );
      impact.current = Math.max(impact.current, 0.08 * adherence.strength);
      excitement.current = Math.max(excitement.current, 0.2 * adherence.strength);
      cloudCling.current.padId = adherence.padId;
      cloudCling.current.type = adherence.type;
      cloudCling.current.position[0] = adherence.position[0];
      cloudCling.current.position[1] = adherence.position[1];
      cloudCling.current.position[2] = adherence.position[2];
      cloudCling.current.relX = adherence.relX;
      cloudCling.current.relZ = adherence.relZ;
      cloudCling.current.strength = Math.max(cloudCling.current.strength, adherence.strength);
      p = body.translation();
      v = body.linvel();
      airborne = Math.abs(v.y) > 0.5;
    }

    const req = consumeLaunch();
    if (req) {
      playerControlStarted.current = true;
      const lv = launchVelocity(req.dir, req.charge, "standard", useGameStore.getState().run.combo);
      body.wakeUp();
      body.setLinvel({ x: lv[0], y: lv[1], z: lv[2] }, true);
      playLaunch(req.charge);
      launchBurst([p.x, p.y - BLOB.radius, p.z], req.charge);
      reportLaunchBurst({
        position: [p.x, p.y - BLOB.radius, p.z],
        charge: req.charge,
        kind: "launch",
      });
      cloudCling.current.strength = 0;
      if (isPerfectRelease(req.charge)) {
        flash("gold", 1);
        playComboFanfare();
      } else if (req.charge > 0.6) {
        flash("blue", req.charge);
      }
    } else if (airborne) {
      stepHazards(p, dt, state.clock.elapsedTime, body);
      stepVortexAttraction(p, dt, body);
    }

    p = body.translation();
    v = body.linvel();
    airborne = Math.abs(v.y) > 0.5;

    const liveVy = v.y;
    const liveAim = getAim();
    const idleStep = stepIdlePatience({
      idleSeconds: idle.current,
      dt: realDt,
      resting: Math.abs(liveVy) <= 0.5,
      aiming: Boolean(liveAim),
    });
    idle.current = idleStep.idleSeconds;

    const speed = Math.hypot(v.x, v.y, v.z);
    if (airborne && speed > 6) {
      const inv = 1 / speed;
      trail([p.x, p.y, p.z], [v.x * inv, v.y * inv, v.z * inv], speed);
    }

    stepNearMisses(p, v);

    if (p.y > maxY.current) {
      maxY.current = p.y;
      setRun({ height: runHeightFromWorldY(p.y) });
      if (p.y - lastEnsureY.current > 10) {
        lastEnsureY.current = p.y;
        ensureHeight(p.y + 180);
        setMusicAltitude(runHeightFromWorldY(p.y));
      }
    }

    stepLandings(p);

    impact.current = Math.max(0, impact.current - dt * blob.decay.impactDecay);
    excitement.current = Math.max(0, excitement.current - dt * blob.decay.excitementDecay);
    cloudCling.current.strength = Math.max(
      0,
      cloudCling.current.strength - dt * (airborne ? 4.8 : 1.2),
    );
    const fallDepth = safeY.current - p.y;
    const expr = classifyExpression({ vy: v.y, impact: impact.current, fallDepth, airborne });

    if (fallDepth > DEATH_FALL_DISTANCE * 0.5) {
      const danger = (fallDepth - DEATH_FALL_DISTANCE * 0.5) / (DEATH_FALL_DISTANCE * 0.5);
      flash("red", danger);
      dangerBeat.current -= realDt;
      if (dangerBeat.current <= 0) {
        dangerBeat.current = blob.dangerBeat.initialTimer - danger * blob.dangerBeat.scale;
        if (useGameStore.getState().settings.haptics) void vibrate(12 + Math.round(danger * 20));
      }
    } else {
      dangerBeat.current = 0;
    }

    const squash = 1 - impact.current * 0.3;
    setBlobDiagnostics({
      position: [p.x, p.y, p.z],
      velocity: [v.x, v.y, v.z],
      speed,
      airborne,
      expression: expr,
      squash,
      maxHeight: runHeightFromWorldY(maxY.current),
      groundY: safeY.current,
      idleSeconds: idle.current,
      excitement: excitement.current,
      bubbleActive: bubbleRemaining.current > 0,
      bubbleRemaining: bubbleRemaining.current,
      cloudAdherence:
        cloudCling.current.strength > 0.01
          ? {
              padId: cloudCling.current.padId,
              type: cloudCling.current.type,
              position: [
                cloudCling.current.position[0],
                cloudCling.current.position[1],
                cloudCling.current.position[2],
              ],
              relX: cloudCling.current.relX,
              relZ: cloudCling.current.relZ,
              strength: cloudCling.current.strength,
            }
          : undefined,
    });

    if (!dead.current && fallDepth > DEATH_FALL_DISTANCE && !isRouteProofSequenceActive()) {
      if (consumeShield()) {
        body.wakeUp();
        body.setTranslation(
          { x: p.x, y: safeY.current + blob.shield.spawnHeightOffset, z: p.z },
          true,
        );
        body.setLinvel({ x: 0, y: blob.shield.reboundVelocity, z: 0 }, true);
        flash("blue", 1);
        playPowerup();
      } else {
        dead.current = true;
        playSplat();
        playDeath();
        commitBestHeight(runHeightFromWorldY(maxY.current));
        setPhase("gameover");
      }
    }
  });

  return (
    <>
      <RigidBody
        ref={bodyRef}
        colliders={false}
        position={[0, STARTER_BLOB_Y, 0]}
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
      {/* Flung goo droplets that have arced away from the body (the ones GooCsg didn't merge)
          shown as instanced wet spheres, so a splash visibly throws goo that falls. */}
      <FreeDroplets skin={skin} getDroplets={getDroplets} />
    </>
  );
}
