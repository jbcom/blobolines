import { useFrame } from "@react-three/fiber";
import { useRapier } from "@react-three/rapier";
import { timeScale } from "@/state";

/**
 * Drives the Rapier world manually so the slow-mo power-up can dilate SIM time independently
 * of REAL time. <Physics> runs `paused`, and this single driver steps it each frame with
 * `realDt * timeScale()` — at the slow-mo scale the world advances less sim-time per frame,
 * stretching the player's mid-air reaction window into true bullet-time.
 *
 * Why manual stepping: @react-three/rapier's fixed-step accumulator advances sim-time 1:1
 * with real-time no matter the `timeStep` prop (the cadence threshold equals the integration
 * dt, and `stepWorld` overwrites `world.timestep` each step). The exposed `step(dt)` is the
 * SAME function the auto-loop calls — accumulator, event queue, sensors and interpolation all
 * intact — so feeding it a scaled dt is genuine bullet-time with no behavioural loss.
 *
 * Priority -10 runs this BEFORE PlayerBlob's default-priority frame loop, so the blob reads a
 * freshly-stepped body each frame (no one-frame lag between the step and the read).
 */
export function PhysicsStepDriver() {
  const { step } = useRapier();
  useFrame((_state, rawDt) => {
    // Clamp the real delta (a tab-refocus / GC pause can spike it to 1–2s) so a stall never
    // fast-forwards the sim, then scale by the active time dilation (1 = normal, <1 = slow-mo).
    const dt = Math.min(rawDt, 0.1) * timeScale();
    if (dt > 0) step(dt);
  }, -10);
  return null;
}
