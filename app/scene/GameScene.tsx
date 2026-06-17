import { Physics } from "@react-three/rapier";
import { Suspense } from "react";
import { GRAVITY } from "@/sim/physics";
import { useGameStore } from "@/state";
import {
  BlobActor,
  BlobTrail,
  PhysicsStepDriver,
  PlayerBlob,
  SplatChunks,
  TrajectoryPreview,
} from "./blob";
import { CameraRig } from "./CameraRig";
import { PostFX } from "./postfx";
import { TrampolineField } from "./trampoline";
import {
  BiomeGeometry,
  BiomeProps,
  BlobCaustic,
  BlobFollowLight,
  BlobShadow,
  CrystalField,
  GoldenRoutePreview,
  LandingTargetMarker,
  LaunchRing,
  Lighting,
  PowerUpField,
  SkyDome,
} from "./world";

/**
 * Root scene composition inside <Canvas>. Composes small, single-responsibility
 * layers (per docs/ARCHITECTURE.md). In MENU it shows a calm hero blob; in PLAYING it
 * runs the Rapier world with the climbing tower and the player blob.
 *
 * The sky + lighting stay mounted across phases (outside Suspense) so the canvas never
 * goes black while Rapier's WASM loads on the first Play.
 */
export function GameScene() {
  const phase = useGameStore((s) => s.phase);
  const skin = useGameStore((s) => s.progress.skin);
  const playing = phase === "playing";

  return (
    <>
      <SkyDome />
      <Lighting />
      <CameraRig active={playing} />

      <Suspense fallback={null}>
        {playing ? (
          // `paused` — PhysicsStepDriver steps the world manually with a slow-mo-scaled dt
          // (true bullet-time; the auto-loop can't dilate sim-time vs real-time).
          <Physics gravity={GRAVITY} paused>
            <PhysicsStepDriver />
            <TrampolineField />
            <PlayerBlob />
            <SplatChunks skin={skin} />
          </Physics>
        ) : (
          <BlobActor skin={skin} expression="idle" />
        )}
      </Suspense>

      {/* Crystals + power-ups are not physics bodies and have no async deps — render
          outside the Physics Suspense boundary so they can never unmount the blob/pads. */}
      {playing && <BiomeGeometry />}
      {playing && <BiomeProps />}
      {playing && <BlobFollowLight />}
      {playing && <BlobShadow />}
      {playing && <BlobCaustic skin={skin} />}
      {playing && <CrystalField />}
      {playing && <PowerUpField />}
      {playing && <LaunchRing />}
      {playing && <BlobTrail skin={skin} />}
      {playing && <TrajectoryPreview />}
      {playing && <LandingTargetMarker />}
      {playing && <GoldenRoutePreview />}

      <PostFX playing={playing} />
    </>
  );
}
