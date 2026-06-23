import { Physics } from "@react-three/rapier";
import { Suspense } from "react";
import { GRAVITY } from "@/sim/physics";
import { useGameStore } from "@/state";
import {
  AirAimPreview,
  BlobActor,
  BlobTrail,
  PhysicsStepDriver,
  PlayerBlob,
  SplatChunks,
  SplitBlobEchoes,
  TrajectoryPreview,
} from "./blob";
import { CameraRig } from "./CameraRig";
import { PostFX } from "./postfx";
import { TrampolineField } from "./trampoline";
import {
  BiomeGeometry,
  BiomeProps,
  BiomeScenicProps,
  BlobCaustic,
  BlobFollowLight,
  BlobShadow,
  CrystalField,
  GoldenRoutePreview,
  LaunchRing,
  Lighting,
  ObstacleField,
  PowerUpField,
  RouteGateField,
  SkyDome,
  TreasureChests,
} from "./world";

/**
 * Root scene composition inside <Canvas>. Composes small, single-responsibility
 * layers (per docs/ARCHITECTURE.md). This scene mounts only in a run (playing/paused/gameover) —
 * the MENU is a separate pure-DOM page (app/views/LandingPage) that never mounts the canvas. While
 * PLAYING it runs the Rapier world with the climbing tower and the player blob; on GAME-OVER
 * (`!active`) it shows a calm idle hero blob behind the game-over card.
 *
 * The sky + lighting stay mounted across these phases (outside Suspense) so the canvas never
 * goes black while Rapier's WASM loads on the first Play.
 */
export function GameScene() {
  const phase = useGameStore((s) => s.phase);
  const skin = useGameStore((s) => s.progress.skin);
  const playing = phase === "playing";
  // The in-run world stays MOUNTED while paused (the run must survive a pause), but the physics
  // stepper freezes — so `active` gates what's on screen, `playing` gates what advances.
  const active = playing || phase === "paused";

  return (
    <>
      <SkyDome />
      <Lighting />
      <CameraRig active={active} />

      <Suspense fallback={null}>
        {active ? (
          // `paused` — PhysicsStepDriver steps the world manually with a slow-mo-scaled dt
          // (true bullet-time; the auto-loop can't dilate sim-time vs real-time). When the game is
          // PAUSED the world stays mounted (so the run survives) but the driver stops advancing it.
          <Physics gravity={GRAVITY} paused>
            <PhysicsStepDriver stepping={playing} />
            <TrampolineField />
            {/* Off-route bounce obstacles: solid fixed colliders the blob ricochets off (inside
                Physics so Rapier resolves the rebound against the blob's collider). */}
            <ObstacleField />
            <PlayerBlob />
            <SplatChunks skin={skin} />
          </Physics>
        ) : (
          // GAME-OVER backdrop: a calm idle hero blob behind the game-over card (menu never
          // reaches here — it's the pure-DOM LandingPage, which mounts no canvas).
          <group position={[0, 3.35, 0]} scale={1.14}>
            <BlobActor skin={skin} expression="idle" />
          </group>
        )}
      </Suspense>

      {/* Crystals + power-ups are not physics bodies and have no async deps — render
          outside the Physics Suspense boundary so they can never unmount the blob/pads. */}
      {active && <BiomeGeometry />}
      {active && <BiomeProps />}
      {active && <BiomeScenicProps />}
      {active && <BlobFollowLight />}
      {active && <BlobShadow />}
      {active && <BlobCaustic skin={skin} />}
      {active && <CrystalField />}
      {active && <TreasureChests />}
      {active && <PowerUpField />}
      {active && <RouteGateField />}
      {active && <LaunchRing />}
      {active && <BlobTrail skin={skin} />}
      {active && <SplitBlobEchoes skin={skin} />}
      {active && <TrajectoryPreview />}
      {/* Mid-air aim arc: the live predicted path while steering, so the player can read where the
          blob is heading (complements TrajectoryPreview, which is the grounded charge aim line). */}
      {active && <AirAimPreview />}
      {active && <GoldenRoutePreview />}

      <PostFX playing={playing} />
    </>
  );
}
