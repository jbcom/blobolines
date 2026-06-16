import type { TrampType } from "@/core/types";
import { reboundMultiplier } from "@/sim/trampoline";

/**
 * Launch + scoring math (pure). Converts an aim direction + charge into a launch
 * velocity, applying the trampoline's rebound and the clean-bounce combo multiplier.
 * The whole game is "go as high as possible", so launch power is the central lever.
 */

export const BASE_POWER = 14;
export const POWER_PER_CHARGE = 17.5;

/** Combo multiplier from a clean-bounce streak (≥2 starts compounding). */
export function comboMultiplier(combo: number): number {
  return combo > 1 ? 1 + (combo - 1) * 0.15 : 1;
}

/**
 * Launch velocity = dir × (base + charge·perCharge) × rebound(type) × combo(streak).
 */
export function launchVelocity(
  dir: readonly [number, number, number],
  charge: number,
  trampType: TrampType,
  combo: number,
): [number, number, number] {
  const power =
    (BASE_POWER + charge * POWER_PER_CHARGE) *
    reboundMultiplier[trampType] *
    comboMultiplier(combo);
  return [dir[0] * power, dir[1] * power, dir[2] * power];
}

/** Auto-launch power when the player rests too long on a pad (gentle pop straight up). */
export const AUTO_LAUNCH_POWER = 16;
