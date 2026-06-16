import { useFrame } from "@react-three/fiber";
import { BallCollider, type RapierRigidBody, RigidBody } from "@react-three/rapier";
import { useEffect, useRef, useState } from "react";
import type { EyeExpression } from "@/core/types";
import { classifyExpression } from "@/sim/blob";
import { launchVelocity } from "@/sim/launch";
import { BLOB, DEATH_FALL_DISTANCE } from "@/sim/physics";
import { consumeLaunch, setBlobDiagnostics, useGameStore, useWorldStore } from "@/state";
import { BlobActor } from "./BlobActor";

/**
 * The PLAYABLE blob — a dynamic Rapier body wrapping the gooey visual. It reports its
 * height to the store (the core-goal readout), extends the tower as it climbs, picks an
 * eye expression from its motion, and triggers game-over when it falls too far. Launch
 * impulses are applied via the imperative ref by the input layer.
 */

export function PlayerBlob() {
  const bodyRef = useRef<RapierRigidBody>(null);
  const skin = useGameStore((s) => s.progress.skin);
  const setRun = useGameStore((s) => s.setRun);
  const setPhase = useGameStore((s) => s.setPhase);
  const commitBestHeight = useGameStore((s) => s.commitBestHeight);
  const ensureHeight = useWorldStore((s) => s.ensureHeight);

  const [expression, setExpression] = useState<EyeExpression>("idle");
  const [velocity, setVelocity] = useState<readonly [number, number, number]>([0, 0, 0]);
  const maxY = useRef(0);

  // Reset body to the starter pad whenever a run begins.
  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    body.setTranslation({ x: 0, y: 3, z: 0 }, true);
    body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    maxY.current = 3;
  }, []);

  useFrame(() => {
    const body = bodyRef.current;
    if (!body) return;
    const p = body.translation();
    const v = body.linvel();
    setVelocity([v.x, v.y, v.z]);

    // Apply a queued launch (set the velocity directly for a crisp, predictable pop).
    const req = consumeLaunch();
    if (req) {
      const lv = launchVelocity(req.dir, req.charge, "standard", useGameStore.getState().run.combo);
      body.wakeUp();
      body.setLinvel({ x: lv[0], y: lv[1], z: lv[2] }, true);
    }

    // Height-chase readout + tower extension.
    if (p.y > maxY.current) {
      maxY.current = p.y;
      setRun({ height: p.y });
      ensureHeight(p.y + 180);
    }

    // Expression from motion.
    const fallDepth = maxY.current - p.y;
    const expr = classifyExpression({ vy: v.y, impact: 0, fallDepth, airborne: true });
    setExpression(expr);

    // Live diagnostics for the dev-harness before/after dumps.
    setBlobDiagnostics({
      position: [p.x, p.y, p.z],
      velocity: [v.x, v.y, v.z],
      speed: Math.hypot(v.x, v.y, v.z),
      airborne: Math.abs(v.y) > 0.1,
      expression: expr,
      squash: 1,
      maxHeight: maxY.current,
    });

    // Death: fell too far below the best height reached.
    if (fallDepth > DEATH_FALL_DISTANCE) {
      commitBestHeight(maxY.current);
      setPhase("gameover");
    }
  });

  return (
    <RigidBody
      ref={bodyRef}
      colliders={false}
      position={[0, 5, 0]}
      linearDamping={BLOB.linearDamping}
      friction={BLOB.friction}
      restitution={BLOB.restitution}
      ccd={BLOB.ccd}
      canSleep={false}
      enabledRotations={[false, false, false]}
    >
      <BallCollider args={[BLOB.radius]} />
      <BlobActor skin={skin} velocity={velocity} expression={expression} radius={BLOB.radius} />
    </RigidBody>
  );
}
