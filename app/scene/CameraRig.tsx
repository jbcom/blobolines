import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import type { PerspectiveCamera } from "three";
import { damp } from "@/core/math";
import type { TrampolineSpec, Vec3 } from "@/core/types";
import { getBlobDiagnostics, useWorldStore } from "@/state";

/** Resting field of view; a launch punches it wider then it eases back (the "hyperspace" kick). */
export const BASE_FOV = 60;
/** Max extra degrees added at a full-power launch. */
export const FOV_WARP = 16;
/** Min upward-velocity jump (m/s) between frames that counts as a "launch" for the FOV punch. */
export const LAUNCH_JUMP_MIN = 8;
/** A launch jump this big (m/s) maxes the warp; the warp scales linearly up to it. */
export const LAUNCH_JUMP_FULL = 28;
/** Time constant (s) for the warp easing back to base. */
const WARP_TAU = 0.35;
const PAD_LOOKAHEAD_MAX_SPEED = 8;
const PAD_LOOKAHEAD_MAX_GAP = 32;

/** New warp amount [0,1] after a launch jump: spike on a big positive vy jump, capped at 1.
 *  Pure so the FOV-punch trigger curve is unit-tested. */
export function warpFromJump(prevWarp: number, launchJump: number): number {
  if (launchJump > LAUNCH_JUMP_MIN) {
    return Math.min(1, Math.max(prevWarp, launchJump / LAUNCH_JUMP_FULL));
  }
  return prevWarp;
}

/** Ease a warp value back toward 0 over WARP_TAU. Pure. */
export function decayWarp(warp: number, dt: number): number {
  return warp * Math.exp(-dt / WARP_TAU);
}

/** Field of view for a given warp amount. Pure. */
export function fovForWarp(warp: number): number {
  return BASE_FOV + warp * FOV_WARP;
}

function defaultLookTarget(blobPosition: Vec3): Vec3 {
  return [blobPosition[0], blobPosition[1] + 1.5, blobPosition[2]];
}

export function cameraLookTarget(
  blobPosition: Vec3,
  speed: number,
  pads: readonly TrampolineSpec[],
): Vec3 {
  const base = defaultLookTarget(blobPosition);
  const slowFactor = Math.max(0, 1 - speed / PAD_LOOKAHEAD_MAX_SPEED);
  if (slowFactor <= 0) return base;

  const nextPad = pads.find(
    (pad) =>
      pad.position[1] > blobPosition[1] + 2 &&
      pad.position[1] < blobPosition[1] + PAD_LOOKAHEAD_MAX_GAP,
  );
  if (!nextPad) return base;

  const lateralBlend = 0.38 * slowFactor;
  const verticalBlend = 0.62 * slowFactor;
  return [
    base[0] + (nextPad.position[0] - base[0]) * lateralBlend,
    base[1] + (nextPad.position[1] - base[1]) * verticalBlend,
    base[2] + (nextPad.position[2] - base[2]) * lateralBlend,
  ];
}

/**
 * Camera rig. In MENU it slowly orbits the hero blob; in PLAYING it FOLLOWS the live blob
 * — its real x/y/z from the diagnostics bridge, not just the height readout — so lateral
 * air-steering and arcs stay framed instead of flying the blob off-screen. Pulls back with
 * speed, punches the FOV on a launch (hyperspace warp), and adds a short decaying impact shake.
 */
export function CameraRig({ active }: { active: boolean }) {
  const camera = useThree((s) => s.camera);
  const t = useRef(0);
  /** Decaying camera-shake amplitude, spiked on a hard landing. */
  const shake = useRef(0);
  /** Last impact level seen, to detect a fresh landing (squash dips below 1). */
  const lastImpact = useRef(0);
  /** Last upward velocity seen, to detect a fresh launch (a sharp positive vy jump). */
  const lastVy = useRef(0);
  /** Current FOV-warp amount [0,1], spiked on launch, eased back to 0 each frame. */
  const warp = useRef(0);

  useFrame((_, dt) => {
    t.current += dt;
    const cam = camera as PerspectiveCamera;
    if (active) {
      const diag = getBlobDiagnostics();
      const [bx, by, bz] = diag.position;
      const speed = diag.speed;

      // Detect a fresh impact (squash drops) → kick the shake.
      const impact = 1 - diag.squash; // 0..~0.3
      if (impact > lastImpact.current + 0.04) shake.current = Math.min(1, impact * 3);
      lastImpact.current = impact;
      shake.current *= Math.exp(-dt / 0.12); // fast decay

      // FOV WARP on launch: a sharp jump in upward velocity (slingshot release, super pad, thrust)
      // punches the FOV wider for a "hyperspace" kick that sells the speed, then eases back. The
      // warp scales with how big the launch was, capped so it never disorients.
      const vy = diag.velocity[1];
      warp.current = warpFromJump(warp.current, vy - lastVy.current);
      lastVy.current = vy;
      warp.current = decayWarp(warp.current, dt);
      const targetFov = fovForWarp(warp.current);
      if (Math.abs(cam.fov - targetFov) > 0.01) {
        cam.fov = targetFov;
        cam.updateProjectionMatrix();
      }

      // Pull back a touch as the blob moves fast (sense of speed), framed slightly above.
      const pull = Math.min(speed / 26, 1);
      const camDist = 11 + pull * 4;
      const camLift = 6 + pull * 2;

      const k = damp(dt, 0.16);
      camera.position.x += (bx - camera.position.x) * k;
      camera.position.y += (by + camLift - camera.position.y) * k;
      camera.position.z += (bz + camDist - camera.position.z) * k;

      // Impact shake (decays in ~0.12s) — small, juicy, never disorienting.
      const s = shake.current * 0.5;
      camera.position.x += Math.sin(t.current * 90) * s;
      camera.position.y += Math.cos(t.current * 83) * s;

      // Look at the blob in flight, but while resting/slowly aiming bias upward and sideways
      // toward the next generated pad so the opening target is readable before launch.
      const [lookX, lookY, lookZ] = cameraLookTarget(
        diag.position,
        speed,
        useWorldStore.getState().trampolines,
      );
      camera.lookAt(lookX, lookY, lookZ);
    } else {
      // Menu: clear the launch warp + FOV back to base (so re-entering a run starts unwarped),
      // and reset the launch tracker so the first in-run launch is detected fresh.
      warp.current = 0;
      lastVy.current = 0;
      if (cam.fov !== BASE_FOV) {
        cam.fov = BASE_FOV;
        cam.updateProjectionMatrix();
      }
      // A gentle orbit AROUND the hero blob at a fixed, sane distance. (The old form
      // `cos·6+4` let z swing to -2 — the camera passing THROUGH the blob, blowing it up to
      // fill the screen. Drive a constant-radius circle instead so the blob stays nicely
      // framed at all orbit phases.)
      const a = t.current * 0.25;
      const RADIUS = 9;
      camera.position.x = Math.sin(a) * RADIUS;
      camera.position.z = Math.cos(a) * RADIUS;
      camera.position.y = 1.5 + Math.sin(t.current * 0.4) * 0.5;
      camera.lookAt(0, 0, 0);
    }
  });

  return null;
}
