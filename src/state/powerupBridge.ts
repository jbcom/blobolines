import type { PowerUpType } from "@/core/types";

/**
 * Active power-up bridge — magnet/thruster have frame-cadence countdown timers, so they
 * live here (imperative) rather than in the React store, to avoid a re-render every
 * frame. PlayerBlob ticks them; the HUD badges poll `isActive`. Collected power-ups call
 * `activate`; the run reset clears them.
 */

const remaining: Record<PowerUpType, number> = { magnet: 0, thruster: 0 };

export const POWERUP_DURATION: Record<PowerUpType, number> = {
  magnet: 8,
  thruster: 3.5,
};

export function activatePowerup(type: PowerUpType): void {
  remaining[type] = POWERUP_DURATION[type];
}

/** Decrement all active timers by dt (called once per frame by the blob). Returns the list of
 *  power-ups that EXPIRED this tick (crossed from active to 0) so the caller can fire a
 *  power-down cue exactly once. */
export function tickPowerups(dt: number): PowerUpType[] {
  const expired: PowerUpType[] = [];
  for (const type of ["magnet", "thruster"] as const) {
    if (remaining[type] > 0) {
      remaining[type] = Math.max(0, remaining[type] - dt);
      if (remaining[type] === 0) expired.push(type);
    }
  }
  return expired;
}

export function isPowerupActive(type: PowerUpType): boolean {
  return remaining[type] > 0;
}

export function powerupRemaining(type: PowerUpType): number {
  return remaining[type];
}

export function resetPowerups(): void {
  remaining.magnet = 0;
  remaining.thruster = 0;
}
