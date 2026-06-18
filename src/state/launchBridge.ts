/**
 * Input bridge — a tiny imperative channel from the DOM/keyboard input layer to the
 * physics blob. The overlay stores the latest launch (dir + charge) on hold-release
 * release (last-write-wins, consumed once next frame); the air-steer force is a
 * continuous X/Z value the blob reads each frame while airborne. Avoids threading refs
 * through the React tree while keeping UI and physics decoupled.
 */

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

/** Live AIM preview while charging the route launch (dir + charge), or null when not aiming.
 *  Read each frame by the in-scene trajectory preview so the player sees where they'll go
 *  BEFORE releasing so targeting feedback is visible while charging. */
let aim: LaunchRequest | null = null;

export function setAim(req: LaunchRequest | null): void {
  aim = req;
}

export function getAim(): LaunchRequest | null {
  return aim;
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
export type GroundRingKind = "launch" | "land";
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

/** A pending trampoline rebound: the rebound speed to bounce the blob at, the pad type
 *  (for combo/scoring), and the pad's surface NORMAL — the launch direction. A flat pad's
 *  normal is straight up [0,1,0]; a canted pad's normal tilts, redirecting the bounce
 *  laterally so the blob is thrown sideways-and-up toward the next pad (navigability).
 *  Reported by a trampoline on contact, consumed by the blob. */
export interface ReboundRequest {
  speed: number;
  type: string;
  /** Unit surface normal = launch direction. Defaults to straight up when omitted. */
  normal?: readonly [number, number, number];
}

let rebound: ReboundRequest | null = null;

export function reportRebound(req: ReboundRequest): void {
  // Keep the strongest pending rebound if several pads are touched in one frame.
  if (!rebound || req.speed > rebound.speed) rebound = req;
}

export function consumeRebound(): ReboundRequest | null {
  const r = rebound;
  rebound = null;
  return r;
}

/**
 * Clear ALL pending bridge state. Called on run end (menu/gameover) so a value reported in
 * the last frame before the run ended can't fire on the next run's first frame. (powerups
 * have their own resetPowerups; this covers launch/aim/rebound/splat/steer/impact.)
 */
export function resetBridges(): void {
  pending = null;
  aim = null;
  rebound = null;
  splatQueue = [];
  launchBurstQueue = [];
  steer = [0, 0];
  landingImpact = 0;
  landing = null;
  midAirBounce = false;
  setRouteProofTarget(null);
  clearRouteLandingFeedback();
}
