import { beforeEach, describe, expect, it } from "vitest";
import {
  activatePowerup,
  consumeShield,
  hasShield,
  isPowerupActive,
  POWERUP_DURATION,
  powerupRemaining,
  resetPowerups,
  SLOWMO_SCALE,
  tickPowerups,
  timeScale,
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

  it("shield is a one-shot flag: activate → held → consume once → gone", () => {
    expect(hasShield()).toBe(false);
    activatePowerup("shield");
    expect(hasShield()).toBe(true);
    expect(isPowerupActive("shield")).toBe(true);
    expect(consumeShield()).toBe(true); // absorbed a fatal fall
    expect(hasShield()).toBe(false);
    expect(consumeShield()).toBe(false); // already spent
  });

  it("shield doesn't tick down like a timer (tickPowerups ignores it)", () => {
    activatePowerup("shield");
    tickPowerups(100); // a huge dt shouldn't expire the shield
    expect(hasShield()).toBe(true);
  });

  it("resetPowerups clears the shield too", () => {
    activatePowerup("shield");
    resetPowerups();
    expect(hasShield()).toBe(false);
  });

  it("slow-mo is a normal timed buff (activates, ticks down, expires once)", () => {
    expect(isPowerupActive("slowmo")).toBe(false);
    activatePowerup("slowmo");
    expect(isPowerupActive("slowmo")).toBe(true);
    expect(powerupRemaining("slowmo")).toBe(POWERUP_DURATION.slowmo);
    expect(tickPowerups(POWERUP_DURATION.slowmo - 0.1)).toEqual([]);
    expect(tickPowerups(0.2)).toEqual(["slowmo"]);
    expect(isPowerupActive("slowmo")).toBe(false);
  });

  it("timeScale dilates to SLOWMO_SCALE only while slow-mo is active", () => {
    expect(timeScale()).toBe(1); // normal speed at rest
    activatePowerup("slowmo");
    expect(timeScale()).toBe(SLOWMO_SCALE); // bullet-time while held
    tickPowerups(POWERUP_DURATION.slowmo); // run it out
    expect(timeScale()).toBe(1); // back to normal speed
  });

  it("resetPowerups clears slow-mo (timeScale returns to 1)", () => {
    activatePowerup("slowmo");
    resetPowerups();
    expect(timeScale()).toBe(1);
    expect(isPowerupActive("slowmo")).toBe(false);
  });
});
