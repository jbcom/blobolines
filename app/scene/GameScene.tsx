import { Physics } from "@react-three/rapier";
import { Suspense } from "react";
import { GRAVITY } from "@/sim/physics";
import { useGameStore } from "@/state";
import { BlobActor, PlayerBlob, SplatChunks, TrajectoryPreview } from "./blob";
import { CameraRig } from "./CameraRig";
import { PostFX } from "./postfx";
import { TrampolineField } from "./trampoline";
import {
  BiomeProps,
  BlobFollowLight,
  BlobShadow,
  CrystalField,
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
          <Physics gravity={GRAVITY}>
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
      {playing && <BiomeProps />}
      {playing && <BlobFollowLight />}
      {playing && <BlobShadow />}
      {playing && <CrystalField />}
      {playing && <PowerUpField />}
      {playing && <LaunchRing />}
      {playing && <TrajectoryPreview />}

      <PostFX />
    </>
  );
}
