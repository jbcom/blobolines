import { describe, expect, it } from "vitest";
import {
  BASE_FOV,
  cameraLookTarget,
  cameraRouteDirection,
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

describe("camera pad lookahead", () => {
  const nextPad = {
    id: 8,
    position: [4, 8, -2] as const,
    width: 8.4,
    depth: 8.4,
    type: "standard" as const,
  };
  const followPad = {
    id: 17,
    position: [-2, 17, 3] as const,
    width: 8.4,
    depth: 8.4,
    type: "standard" as const,
  };

  it("biases the resting camera toward the next two pads", () => {
    const target = cameraLookTarget([0, 1.46, 0], 1.46, 0, [nextPad, followPad]);
    expect(target[0]).toBeGreaterThan(0);
    expect(target[1]).toBeGreaterThan(8);
    expect(target[1]).toBeLessThan(9);
    expect(target[2]).toBeLessThan(0);
  });

  it("returns to blob-follow framing when the blob is moving fast", () => {
    expect(cameraLookTarget([1, 12, 3], 1.46, 12, [nextPad, followPad])).toEqual([1, 13.5, 3]);
  });

  it("ignores pads too high to be the immediate target", () => {
    const highPad = { ...nextPad, id: 50, position: [4, 50, -2] as const };
    expect(cameraLookTarget([0, 1.46, 0], 1.46, 0, [highPad])).toEqual([0, 2.96, 0]);
  });

  it("orients the camera opposite the next-route direction", () => {
    const [dx, dz] = cameraRouteDirection([0, 1.46, 0], 1.46, [nextPad, followPad]);
    expect(dx).toBeGreaterThan(0);
    expect(dz).toBeLessThan(0);
    expect(Math.hypot(dx, dz)).toBeCloseTo(1, 5);
  });
});
