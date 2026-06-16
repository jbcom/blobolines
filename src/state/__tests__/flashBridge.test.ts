import { afterEach, describe, expect, it } from "vitest";
import { consumeFlash, flash, resetFlash } from "../flashBridge";

afterEach(() => resetFlash());

describe("flashBridge", () => {
  it("returns null when no flash is pending", () => {
    expect(consumeFlash()).toBeNull();
  });

  it("consumes a fired flash exactly once", () => {
    flash("gold", 0.5);
    expect(consumeFlash()).toEqual({ kind: "gold", intensity: 0.5 });
    expect(consumeFlash()).toBeNull();
  });

  it("keeps the strongest request when several fire in one frame", () => {
    flash("blue", 0.3);
    flash("red", 0.9);
    flash("gold", 0.4);
    expect(consumeFlash()).toEqual({ kind: "red", intensity: 0.9 });
  });

  it("clamps intensity to [0,1]", () => {
    flash("gold", 5);
    expect(consumeFlash()?.intensity).toBe(1);
    flash("blue", -2);
    expect(consumeFlash()?.intensity).toBe(0);
  });

  it("resetFlash clears a pending flash", () => {
    flash("red", 1);
    resetFlash();
    expect(consumeFlash()).toBeNull();
  });
});
