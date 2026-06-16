import { launch as launchCfg } from "@/config";
import type { TrampType } from "@/core/types";
import { reboundMultiplier } from "@/sim/trampoline";

/**
 * Launch + scoring math (pure). Converts an aim direction + charge into a launch
 * velocity, applying the trampoline's rebound and the clean-bounce combo multiplier.
 * The whole game is "go as high as possible", so launch power is the central lever.
 * Tunables are data-driven from src/config/launch.json.
 */

export const BASE_POWER = launchCfg.basePower;
export const POWER_PER_CHARGE = launchCfg.powerPerCharge;

/** Combo multiplier from a clean-bounce streak (≥ comboStart compounds). */
export function comboMultiplier(combo: number): number {
  return combo >= launchCfg.comboStart ? 1 + (combo - 1) * launchCfg.comboStep : 1;
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
