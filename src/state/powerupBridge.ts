import type { PowerUpType } from "@/core/types";

/**
 * Active power-up bridge — magnet/thruster have frame-cadence countdown timers, so they
 * live here (imperative) rather than in the React store, to avoid a re-render every
 * frame. PlayerBlob ticks them; the HUD badges poll `isActive`. Collected power-ups call
 * `activate`; the run reset clears them. SHIELD is different — a one-shot second-life flag
 * (not a timer) consumed when a fatal fall would otherwise end the run.
 */

/** Power-ups with a timed duration (shield is excluded — it's a one-shot flag). */
type TimedPowerUp = "magnet" | "thruster";

const remaining: Record<TimedPowerUp, number> = { magnet: 0, thruster: 0 };
/** One-shot shield charge: true = the next fatal fall is absorbed instead of ending the run. */
let shielded = false;

export const POWERUP_DURATION: Record<TimedPowerUp, number> = {
  magnet: 8,
  thruster: 3.5,
};

export function activatePowerup(type: PowerUpType): void {
  if (type === "shield") {
    shielded = true;
    return;
  }
  remaining[type] = POWERUP_DURATION[type];
}

/** Does the blob currently hold a one-shot shield? */
export function hasShield(): boolean {
  return shielded;
}

/** Consume the shield (call when a fatal fall is absorbed). Returns true if one was held. */
export function consumeShield(): boolean {
  if (!shielded) return false;
  shielded = false;
  return true;
}

/** Shared empty result so the common (nothing-expired) path allocates nothing per frame. */
const NONE_EXPIRED: readonly PowerUpType[] = [];

/** Decrement all active timers by dt (called once per frame by the blob). Returns the list of
 *  power-ups that EXPIRED this tick (crossed from active to 0) so the caller can fire a
 *  power-down cue exactly once. Returns a shared empty array when nothing expired (the common
 *  case) so the per-frame call doesn't churn the GC. */
export function tickPowerups(dt: number): readonly PowerUpType[] {
  let expired: PowerUpType[] | null = null;
  for (const type of ["magnet", "thruster"] as const) {
    if (remaining[type] > 0) {
      remaining[type] = Math.max(0, remaining[type] - dt);
      if (remaining[type] === 0) {
        if (!expired) expired = [];
        expired.push(type);
      }
    }
  }
  return expired ?? NONE_EXPIRED;
}

export function isPowerupActive(type: PowerUpType): boolean {
  if (type === "shield") return shielded;
  return remaining[type] > 0;
}

export function powerupRemaining(type: PowerUpType): number {
  // Shield is a one-shot flag, not a timer — report 1/0 so a HUD badge can still show it.
  if (type === "shield") return shielded ? 1 : 0;
  return remaining[type];
}

export function resetPowerups(): void {
  remaining.magnet = 0;
  remaining.thruster = 0;
  shielded = false;
}
