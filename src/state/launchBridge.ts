/**
 * Input bridge — a tiny imperative channel from the DOM/keyboard input layer to the
 * physics blob. The overlay stores the latest launch (dir + charge) on hold-release
 * release (last-write-wins, consumed once next frame); the air-steer force is a
 * continuous X/Z value the blob reads each frame while airborne. Avoids threading refs
 * through the React tree while keeping UI and physics decoupled.
 */

import type { RouteGateKind, SlicerFragmentLane, Vec3 } from "@/core/types";
import { clearRouteLandingFeedback } from "./routeFeedbackBridge";
import { setRouteProofTarget } from "./routeProofBridge";

export interface LaunchRequest {
  dir: readonly [number, number, number];
  charge: number;
}

let pending: LaunchRequest | null = null;

export function requestLaunch(req: LaunchRequest): void {
  pending = req;
}

/** Consume the pending launch (returns it once, then clears). */
export function consumeLaunch(): LaunchRequest | null {
  const r = pending;
  pending = null;
  return r;
}

/** Pending dev teleport target altitude (world Y). DevHarness / test bridge requests it; the
 *  PlayerBlob frame loop consumes it once to jump the Rapier body to that band. Dev/test only. */
let pendingTeleport: number | null = null;

export function requestTeleport(y: number): void {
  pendingTeleport = y;
}

/** Consume the pending teleport target (returns it once, then clears). */
export function consumeTeleport(): number | null {
  const y = pendingTeleport;
  pendingTeleport = null;
  return y;
}

export interface RouteGateHitEvent {
  gateId: string;
  kind: RouteGateKind;
  position: readonly [number, number, number];
  velocity: readonly [number, number, number];
  normal: readonly [number, number, number];
  strength: number;
  fragmentCount?: number;
  splitSpread?: number;
  fragmentLanes?: readonly SlicerFragmentLane[];
}

let routeGateHit: RouteGateHitEvent | null = null;

export function reportRouteGateHit(event: RouteGateHitEvent): void {
  routeGateHit = event;
}

export function consumeRouteGateHit(): RouteGateHitEvent | null {
  const event = routeGateHit;
  routeGateHit = null;
  return event;
}

export interface BlobSplitEvent {
  position: readonly [number, number, number];
  velocity: readonly [number, number, number];
  normal: readonly [number, number, number];
  count: number;
  spread: number;
  strength: number;
  fragmentLanes?: readonly SlicerFragmentLane[];
}

let splitQueue: BlobSplitEvent[] = [];

export function reportBlobSplit(event: BlobSplitEvent): void {
  splitQueue.push(event);
  if (splitQueue.length > 4) splitQueue = splitQueue.slice(-4);
}

export function consumeBlobSplits(): BlobSplitEvent[] {
  if (splitQueue.length === 0) return splitQueue;
  const out = splitQueue;
  splitQueue = [];
  return out;
}

/** Live AIM preview while charging the route launch (dir + charge), or null when not aiming.
 *  Read each frame by the in-scene trajectory preview so the player sees where they'll go
 *  BEFORE releasing so targeting feedback is visible while charging. */
let aim: LaunchRequest | null = null;

export function setAim(req: LaunchRequest | null): void {
  aim = req;
  if (!req) blobFaceFocus = null;
}

export function getAim(): LaunchRequest | null {
  return aim;
}

export interface BlobFaceFocusTarget {
  kind: "routeEndpoint" | "slicer";
  position: Vec3;
  intensity: number;
}

let blobFaceFocus: BlobFaceFocusTarget | null = null;

export function setBlobFaceFocusTarget(target: BlobFaceFocusTarget | null): void {
  blobFaceFocus = target;
}

export function getBlobFaceFocusTarget(): BlobFaceFocusTarget | null {
  return blobFaceFocus;
}

/** Splat-burst events: a hard landing flings real physics goo chunks from a point. The
 *  blob reports them here; the SplatChunks system (inside <Physics>) drains the queue each
 *  frame and spawns Rapier bodies that bounce/roll/settle. Kept tiny (last-few wins). */
export interface SplatBurst {
  position: readonly [number, number, number];
  strength: number;
}

let splatQueue: SplatBurst[] = [];

export function reportSplat(burst: SplatBurst): void {
  splatQueue.push(burst);
  if (splatQueue.length > 4) splatQueue = splatQueue.slice(-4); // cap pending bursts
}

/** Drain all pending splat bursts (returns them once, then clears). */
export function consumeSplats(): SplatBurst[] {
  if (splatQueue.length === 0) return splatQueue;
  const out = splatQueue;
  splatQueue = [];
  return out;
}

/** A ground-ring "pop" event: an expanding ring blooms at the pad. `kind` "launch" is the
 *  hold-release launch pop (blue, blooms from small); "land" is the impact ring on touchdown
 *  (gold, sized by impact). `charge` [0,1] scales the ring's size + brightness. Reported by
 *  the blob, drained by the LaunchRing VFX. */
export type GroundRingKind = "launch" | "land" | "nudge";
export interface LaunchBurstEvent {
  position: readonly [number, number, number];
  charge: number;
  kind: GroundRingKind;
}

let launchBurstQueue: LaunchBurstEvent[] = [];

export function reportLaunchBurst(ev: LaunchBurstEvent): void {
  launchBurstQueue.push(ev);
  if (launchBurstQueue.length > 4) launchBurstQueue = launchBurstQueue.slice(-4);
}

/** Drain pending launch-burst events (returns them once, then clears). */
export function consumeLaunchBursts(): LaunchBurstEvent[] {
  if (launchBurstQueue.length === 0) return launchBurstQueue;
  const out = launchBurstQueue;
  launchBurstQueue = [];
  return out;
}

/** A pending MID-AIR BOUNCE request: the player tapped while airborne with multi-bounce
 *  charges held, asking for a free extra upward bounce (a "double-jump" recovery). Set by the
 *  input layer (only after a charge is confirmed available), consumed once by the blob. */
let midAirBounce = false;

export function requestMidAirBounce(): void {
  midAirBounce = true;
}

/** Consume the pending mid-air bounce (returns true once, then clears). */
export function consumeMidAirBounce(): boolean {
  const b = midAirBounce;
  midAirBounce = false;
  return b;
}

/** Continuous mid-air steering force on the world X/Z plane (lateral accel). */
let steer: readonly [number, number] = [0, 0];

export function setAirSteer(x: number, z: number): void {
  steer = [x, z];
}

export function getAirSteer(): readonly [number, number] {
  return steer;
}

/** Latest landing impact speed, reported by a trampoline, consumed once by the blob. */
let landingImpact = 0;

export function reportImpact(speed: number): void {
  landingImpact = Math.max(landingImpact, speed);
}

/** Consume the pending landing impact speed (returns it once, then clears). */
export function consumeImpact(): number {
  const s = landingImpact;
  landingImpact = 0;
  return s;
}

export interface LandingEvent {
  padId: number;
  speed: number;
  position: readonly [number, number, number];
  relX: number;
  relZ: number;
}

let landing: LandingEvent | null = null;

export function reportLanding(event: LandingEvent): void {
  if (!landing || event.speed > landing.speed) landing = event;
}

export function consumeLanding(): LandingEvent | null {
  const event = landing;
  landing = null;
  return event;
}

/** A soft cloud-pad adherence request. Unlike the old solid platform collider, cloud pads let
 *  Blobby pass upward through their underside, then apply a gentle settle only after the body is
 *  descending inside the cloud skin. The blob physics loop consumes this to damp velocity and
 *  hold Blobby nestled on the cloud without adding a hard floor. */
export interface CloudAdherenceRequest {
  padId: number;
  type: string;
  position: readonly [number, number, number];
  settleY: number;
  relX: number;
  relZ: number;
  strength: number;
}

let cloudAdherence: CloudAdherenceRequest | null = null;

export function reportCloudAdherence(req: CloudAdherenceRequest): void {
  if (!cloudAdherence || req.strength > cloudAdherence.strength) cloudAdherence = req;
}

export function consumeCloudAdherence(): CloudAdherenceRequest | null {
  const req = cloudAdherence;
  cloudAdherence = null;
  return req;
}

/** Mid-air redirect / nudge direction [x, z]. Set by user flick/Shift key, consumed once by blob. */
let pendingNudge: readonly [number, number] | null = null;

export function requestAirNudge(x: number, z: number): void {
  pendingNudge = [x, z];
}

export function consumeAirNudge(): readonly [number, number] | null {
  const n = pendingNudge;
  pendingNudge = null;
  return n;
}

/**
 * Clear ALL pending bridge state. Called on run end (menu/gameover) so a value reported in
 * the last frame before the run ended can't fire on the next run's first frame. (powerups
 * have their own resetPowerups; this covers launch/aim/cloud/splat/steer/impact.)
 */
export function resetBridges(): void {
  pending = null;
  aim = null;
  blobFaceFocus = null;
  routeGateHit = null;
  splitQueue = [];
  cloudAdherence = null;
  splatQueue = [];
  launchBurstQueue = [];
  steer = [0, 0];
  landingImpact = 0;
  landing = null;
  midAirBounce = false;
  pendingNudge = null;
  pendingTeleport = null;
  setRouteProofTarget(null);
  clearRouteLandingFeedback();
}
