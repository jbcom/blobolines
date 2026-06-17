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

/** Combo multiplier from a clean-bounce streak: 1× until `comboStart`, then +comboStep per
 *  bounce. Anchored at comboStart (not hardcoded to 2) so the config value is respected —
 *  at combo === comboStart the first bonus is exactly +comboStep. */
export function comboMultiplier(combo: number): number {
  const { comboStart, comboStep } = launchCfg;
  return combo >= comboStart ? 1 + (combo - comboStart + 1) * comboStep : 1;
}

/** Perfect-release sweet spot: charging into this band (just shy of full) and releasing earns a
 *  power bonus — a timing skill on top of "drag farther = stronger", rewarding a committed-but-
 *  controlled pull without punishing anyone (below the band is just normal power). */
export const PERFECT_RELEASE = launchCfg.perfectRelease as {
  min: number;
  max: number;
  bonus: number;
};

/** True if a release at `charge` lands in the perfect window. */
export function isPerfectRelease(charge: number): boolean {
  return charge >= PERFECT_RELEASE.min && charge <= PERFECT_RELEASE.max;
}

/** Power multiplier from the release timing: PERFECT_RELEASE.bonus inside the window, else 1. */
export function perfectReleaseMultiplier(charge: number): number {
  return isPerfectRelease(charge) ? PERFECT_RELEASE.bonus : 1;
}

/**
 * Launch velocity = dir × (base + charge·perCharge) × rebound(type) × combo(streak) ×
 * perfect-release(charge). The perfect-release window is a timing-skill bonus on top of the
 * pure charge ramp.
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
    comboMultiplier(combo) *
    perfectReleaseMultiplier(charge);
  return [dir[0] * power, dir[1] * power, dir[2] * power];
}

/** Auto-launch power when the player rests too long on a pad (gentle pop straight up). */
export const AUTO_LAUNCH_POWER = 16;
