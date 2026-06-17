import { beforeEach, describe, expect, it } from "vitest";
import {
  activatePowerup,
  isPowerupActive,
  POWERUP_DURATION,
  powerupRemaining,
  resetPowerups,
  tickPowerups,
} from "../powerupBridge";

beforeEach(() => resetPowerups());

describe("powerupBridge", () => {
  it("activate sets the duration and isActive flips true", () => {
    expect(isPowerupActive("magnet")).toBe(false);
    activatePowerup("magnet");
    expect(isPowerupActive("magnet")).toBe(true);
    expect(powerupRemaining("magnet")).toBe(POWERUP_DURATION.magnet);
  });

  it("tick counts down and returns the EXPIRED powerups exactly once", () => {
    activatePowerup("thruster");
    // Not yet expired partway through.
    expect(tickPowerups(POWERUP_DURATION.thruster - 0.1)).toEqual([]);
    expect(isPowerupActive("thruster")).toBe(true);
    // The tick that crosses zero reports the expiry once.
    expect(tickPowerups(0.2)).toEqual(["thruster"]);
    expect(isPowerupActive("thruster")).toBe(false);
    // A subsequent tick does NOT re-report it (already at 0).
    expect(tickPowerups(0.2)).toEqual([]);
  });

  it("reports multiple simultaneous expiries", () => {
    activatePowerup("magnet");
    activatePowerup("thruster");
    const expired = tickPowerups(Math.max(POWERUP_DURATION.magnet, POWERUP_DURATION.thruster));
    expect([...expired].sort()).toEqual(["magnet", "thruster"]);
  });

  it("resetPowerups clears all timers", () => {
    activatePowerup("magnet");
    resetPowerups();
    expect(isPowerupActive("magnet")).toBe(false);
  });
});
