import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the state bridge so we can assert the nudge/steer contract without a running sim.
const requestAirNudge = vi.fn();
const setAirSteer = vi.fn();
let airborne = true;
vi.mock("@/state", () => ({
  getBlobDiagnostics: () => ({ airborne }),
  requestAirNudge: (...a: unknown[]) => requestAirNudge(...a),
  setAirSteer: (...a: unknown[]) => setAirSteer(...a),
}));

import { useKeyboardSteer } from "../useKeyboardSteer";

function keydown(code: string, opts: KeyboardEventInit = {}) {
  window.dispatchEvent(new KeyboardEvent("keydown", { code, ...opts }));
}

describe("useKeyboardSteer air nudge", () => {
  beforeEach(() => {
    requestAirNudge.mockClear();
    setAirSteer.mockClear();
    airborne = true;
  });
  afterEach(() => vi.clearAllMocks());

  it("nudges exactly once when a direction is pressed while Shift is held", () => {
    renderHook(() => useKeyboardSteer());
    keydown("ArrowRight", { shiftKey: true });
    expect(requestAirNudge).toHaveBeenCalledTimes(1);
    // Right → +x, no z; normalized.
    expect(requestAirNudge).toHaveBeenCalledWith(1, 0);
  });

  it("nudges exactly once when Shift is pressed while a direction is already held", () => {
    renderHook(() => useKeyboardSteer());
    keydown("ArrowUp"); // hold up first (no shift)
    requestAirNudge.mockClear();
    keydown("Shift", { key: "Shift", shiftKey: true });
    expect(requestAirNudge).toHaveBeenCalledTimes(1);
    expect(requestAirNudge).toHaveBeenCalledWith(0, -1); // up → -z
  });

  it("does not nudge when no direction is held", () => {
    renderHook(() => useKeyboardSteer());
    keydown("Shift", { key: "Shift", shiftKey: true });
    expect(requestAirNudge).not.toHaveBeenCalled();
  });

  it("does not nudge while the blob is grounded", () => {
    airborne = false;
    renderHook(() => useKeyboardSteer());
    keydown("ArrowLeft", { shiftKey: true });
    expect(requestAirNudge).not.toHaveBeenCalled();
  });
});
