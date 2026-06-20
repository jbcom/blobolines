import { afterEach, describe, expect, it } from "vitest";
import { consumeTeleport, requestTeleport, resetBridges } from "../launchBridge";

afterEach(() => resetBridges());

describe("teleport bridge", () => {
  it("returns null when no teleport is pending", () => {
    expect(consumeTeleport()).toBeNull();
  });

  it("consumes a requested teleport target exactly once", () => {
    requestTeleport(600);
    expect(consumeTeleport()).toBe(600);
    expect(consumeTeleport()).toBeNull();
  });

  it("keeps the latest target when several are requested before a consume", () => {
    requestTeleport(120);
    requestTeleport(1400);
    expect(consumeTeleport()).toBe(1400);
  });

  it("supports a zero (ground) target without reading as 'no pending'", () => {
    requestTeleport(0);
    expect(consumeTeleport()).toBe(0);
  });

  it("resetBridges clears a pending teleport so it can't fire on the next run", () => {
    requestTeleport(950);
    resetBridges();
    expect(consumeTeleport()).toBeNull();
  });
});
