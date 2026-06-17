import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import { type PerspectiveCamera, Vector3 } from "three";
import { damp } from "@/core/math";
import type { TrampolineSpec, Vec3 } from "@/core/types";
import {
  getBlobDiagnostics,
  getRouteProofTarget,
  getViewControls,
  setBlobScreenTarget,
  useWorldStore,
  type ViewControls,
} from "@/state";

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
const PAD_LOOKAHEAD_MAX_GAP = 42;
const PAD_LOOKAHEAD_MIN_GAP = 0.5;
const MIN_ORBIT_ANGLE = 0.42;
const MAX_ORBIT_ANGLE = 1.42;
const BLOB_SCREEN_MIN_RADIUS = 46;
const BLOB_SCREEN_MAX_RADIUS = 104;

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

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function upcomingRoutePads(groundY: number, pads: readonly TrampolineSpec[]): TrampolineSpec[] {
  return pads
    .filter(
      (pad) =>
        pad.position[1] > groundY + PAD_LOOKAHEAD_MIN_GAP &&
        pad.position[1] < groundY + PAD_LOOKAHEAD_MAX_GAP,
    )
    .slice(0, 2);
}

function routeFocus(upcoming: readonly TrampolineSpec[]) {
  const nextPad = upcoming[0];
  if (!nextPad) return null;
  const followPad = upcoming[1] ?? nextPad;
  return {
    x: nextPad.position[0] * 0.62 + followPad.position[0] * 0.38,
    y: nextPad.position[1] * 0.5 + followPad.position[1] * 0.5,
    z: nextPad.position[2] * 0.62 + followPad.position[2] * 0.38,
  };
}

export function cameraLookTarget(
  blobPosition: Vec3,
  groundY: number,
  speed: number,
  pads: readonly TrampolineSpec[],
): Vec3 {
  const base = defaultLookTarget(blobPosition);
  const slowFactor = Math.max(0, 1 - speed / PAD_LOOKAHEAD_MAX_SPEED);
  if (slowFactor <= 0) return base;

  const target = routeFocus(upcomingRoutePads(groundY, pads));
  if (!target) return base;

  const lateralBlend = 0.44 * slowFactor;
  const verticalBlend = 0.72 * slowFactor;
  return [
    base[0] + (target.x - base[0]) * lateralBlend,
    base[1] + (target.y - base[1]) * verticalBlend,
    base[2] + (target.z - base[2]) * lateralBlend,
  ];
}

export function cameraRouteDirection(
  blobPosition: Vec3,
  groundY: number,
  pads: readonly TrampolineSpec[],
): readonly [number, number] {
  const target = routeFocus(upcomingRoutePads(groundY, pads));
  if (!target) return [0, 1];
  const dx = target.x - blobPosition[0];
  const dz = target.z - blobPosition[2];
  const h = Math.hypot(dx, dz);
  if (h < 0.1) return [0, 1];
  return [dx / h, dz / h];
}

export function cameraOrbitOffset(
  routeDirection: readonly [number, number],
  distance: number,
  height: number,
  view: ViewControls,
): Vec3 {
  const baseAngle = Math.atan2(height, distance);
  const orbitAngle = clamp(baseAngle + view.pitch, MIN_ORBIT_ANGLE, MAX_ORBIT_ANGLE);
  const radius = Math.hypot(distance, height) * view.zoom;
  const horizontal = Math.cos(orbitAngle) * radius;
  const vertical = Math.sin(orbitAngle) * radius;
  const yawSin = Math.sin(view.yaw);
  const yawCos = Math.cos(view.yaw);
  const [rx, rz] = routeDirection;
  const dirX = rx * yawCos - rz * yawSin;
  const dirZ = rx * yawSin + rz * yawCos;
  return [-dirX * horizontal, vertical, -dirZ * horizontal] as const;
}

function proofFocus(
  target: ReturnType<typeof getRouteProofTarget>,
  pads: readonly TrampolineSpec[],
) {
  if (!target) return null;
  const from = pads[target.pairIndex];
  const to = pads[target.pairIndex + 1];
  const proof = from?.goldenPath;
  if (!from || !to || !proof) return null;
  const mid = proof.samples[Math.floor(proof.samples.length / 2)] ?? proof.apex;
  const dx = to.position[0] - from.position[0];
  const dz = to.position[2] - from.position[2];
  const h = Math.hypot(dx, dz) || 1;
  return {
    look: [
      (from.position[0] + to.position[0] + mid[0]) / 3,
      (from.position[1] + to.position[1] + proof.apex[1]) / 3,
      (from.position[2] + to.position[2] + mid[2]) / 3,
    ] as const,
    direction: [dx / h, dz / h] as const,
  };
}

/**
 * Camera rig. In MENU it slowly orbits the hero blob; in PLAYING it FOLLOWS the live blob
 * — its real x/y/z from the diagnostics bridge, not just the height readout — so lateral
 * air-steering and arcs stay framed instead of flying the blob off-screen. Pulls back with
 * speed, punches the FOV on a launch (hyperspace warp), and adds a short decaying impact shake.
 */
export function CameraRig({ active }: { active: boolean }) {
  const camera = useThree((s) => s.camera);
  const screenPoint = useRef(new Vector3());
  const t = useRef(0);
  /** Decaying camera-shake amplitude, spiked on a hard landing. */
  const shake = useRef(0);
  /** Last impact level seen, to detect a fresh landing (squash dips below 1). */
  const lastImpact = useRef(0);
  /** Last upward velocity seen, to detect a fresh launch (a sharp positive vy jump). */
  const lastVy = useRef(0);
  /** Current FOV-warp amount [0,1], spiked on launch, eased back to 0 each frame. */
  const warp = useRef(0);

  useFrame((state, dt) => {
    t.current += dt;
    const cam = camera as PerspectiveCamera;
    if (active) {
      const diag = getBlobDiagnostics();
      const [bx, , bz] = diag.position;
      const speed = diag.speed;
      const pads = useWorldStore.getState().trampolines;
      const view = getViewControls();

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

      const activeProof = proofFocus(getRouteProofTarget(), pads);
      if (activeProof) {
        const [lookX, lookY, lookZ] = activeProof.look;
        const [routeX, routeZ] = activeProof.direction;
        const [offX, offY, offZ] = cameraOrbitOffset([routeX, routeZ], 19, 20, view);
        const k = damp(dt, 0.18);
        camera.position.x += (lookX + offX - camera.position.x) * k;
        camera.position.y += (lookY + offY - camera.position.y) * k;
        camera.position.z += (lookZ + offZ - camera.position.z) * k;
        camera.lookAt(lookX, lookY, lookZ);
        camera.updateMatrixWorld();
        const rect = state.gl.domElement.getBoundingClientRect();
        screenPoint.current.set(diag.position[0], diag.position[1], diag.position[2]).project(cam);
        const screenX = rect.left + ((screenPoint.current.x + 1) * rect.width) / 2;
        const screenY = rect.top + ((1 - screenPoint.current.y) * rect.height) / 2;
        const distance = camera.position.distanceTo(screenPoint.current.set(...diag.position));
        setBlobScreenTarget({
          x: screenX,
          y: screenY,
          radius: clamp(
            1150 / Math.max(8, distance),
            BLOB_SCREEN_MIN_RADIUS,
            BLOB_SCREEN_MAX_RADIUS,
          ),
        });
        return;
      }

      const [lookX, lookY, lookZ] = cameraLookTarget(diag.position, diag.groundY, speed, pads);

      // Top-down/isometric playing-field view: stage the camera ABOVE the route and a little
      // behind its lateral direction. Looking down into the field keeps the blob, current pad,
      // and next two pads readable instead of staring upward through trampoline membranes.
      const pull = Math.min(speed / 26, 1);
      const rest = 1 - pull;
      const camDist = 15 + rest * 7 + pull * 4;
      const camHeight = 15 + rest * 5 + pull * 3;
      const [routeX, routeZ] = cameraRouteDirection(diag.position, diag.groundY, pads);
      const [offX, offY, offZ] = cameraOrbitOffset([routeX, routeZ], camDist, camHeight, view);

      const k = damp(dt, 0.16);
      camera.position.x += (bx + offX - camera.position.x) * k;
      camera.position.y += (lookY + offY - camera.position.y) * k;
      camera.position.z += (bz + offZ - camera.position.z) * k;

      // Impact shake (decays in ~0.12s) — small, juicy, never disorienting.
      const s = shake.current * 0.5;
      camera.position.x += Math.sin(t.current * 90) * s;
      camera.position.y += Math.cos(t.current * 83) * s;

      // Look at the blob in flight, but while resting/slowly aiming bias across the certified
      // route window so the immediate and next trampolines are both in-frame before launch.
      camera.lookAt(lookX, lookY, lookZ);
      camera.updateMatrixWorld();
      const rect = state.gl.domElement.getBoundingClientRect();
      screenPoint.current.set(diag.position[0], diag.position[1], diag.position[2]).project(cam);
      const screenX = rect.left + ((screenPoint.current.x + 1) * rect.width) / 2;
      const screenY = rect.top + ((1 - screenPoint.current.y) * rect.height) / 2;
      const distance = camera.position.distanceTo(screenPoint.current.set(...diag.position));
      setBlobScreenTarget({
        x: screenX,
        y: screenY,
        radius: clamp(1150 / Math.max(8, distance), BLOB_SCREEN_MIN_RADIUS, BLOB_SCREEN_MAX_RADIUS),
      });
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
      camera.position.y = 2.7 + Math.sin(t.current * 0.4) * 0.45;
      camera.lookAt(0, 1.75, 0);
    }
  });

  return null;
}
