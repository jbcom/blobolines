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

/** Decrement all active timers by dt (called once per frame by the blob). */
export function tickPowerups(dt: number): void {
  if (remaining.magnet > 0) remaining.magnet = Math.max(0, remaining.magnet - dt);
  if (remaining.thruster > 0) remaining.thruster = Math.max(0, remaining.thruster - dt);
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
