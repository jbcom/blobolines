import { describe, expect, it } from "vitest";
import {
  BASE_FOV,
  decayWarp,
  FOV_WARP,
  fovForWarp,
  LAUNCH_JUMP_FULL,
  LAUNCH_JUMP_MIN,
  warpFromJump,
} from "../CameraRig";

// The camera FOV-warp (launch "hyperspace" kick) — pure trigger + ease + mapping.
describe("camera FOV warp", () => {
  it("ignores small upward jumps (no warp below the launch threshold)", () => {
    expect(warpFromJump(0, LAUNCH_JUMP_MIN - 1)).toBe(0);
    expect(warpFromJump(0, 0)).toBe(0);
    expect(warpFromJump(0, -20)).toBe(0); // falling never warps
  });

  it("spikes the warp on a real launch jump, scaled by its size and capped at 1", () => {
    const half = warpFromJump(0, LAUNCH_JUMP_FULL / 2);
    expect(half).toBeGreaterThan(0);
    expect(half).toBeLessThan(1);
    // A jump at/over the full threshold maxes the warp.
    expect(warpFromJump(0, LAUNCH_JUMP_FULL)).toBe(1);
    expect(warpFromJump(0, LAUNCH_JUMP_FULL * 2)).toBe(1);
  });

  it("keeps the larger of the existing and new warp (a fresh punch never shrinks an active one)", () => {
    expect(warpFromJump(0.8, LAUNCH_JUMP_FULL / 2)).toBe(0.8); // new (0.5) < existing (0.8)
    expect(warpFromJump(0.2, LAUNCH_JUMP_FULL)).toBe(1); // new (1) > existing
  });

  it("eases the warp back toward zero over time", () => {
    const a = decayWarp(1, 0.1);
    const b = decayWarp(a, 0.1);
    expect(a).toBeLessThan(1);
    expect(b).toBeLessThan(a);
    expect(b).toBeGreaterThan(0);
  });

  it("maps warp 0 → base FOV and warp 1 → base + full warp", () => {
    expect(fovForWarp(0)).toBe(BASE_FOV);
    expect(fovForWarp(1)).toBe(BASE_FOV + FOV_WARP);
    expect(fovForWarp(0.5)).toBeCloseTo(BASE_FOV + FOV_WARP / 2, 5);
  });
});
