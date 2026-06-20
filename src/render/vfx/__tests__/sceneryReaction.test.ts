import { describe, expect, it } from "vitest";
import type { Vec3 } from "@/core/types";
import {
  DEFAULT_FLYBY_PULSE,
  DEFAULT_SCENERY_REACTION,
  flybyPeaked,
  sceneryReaction,
  stepFlybyPulse,
} from "../sceneryReaction";

const FAST: Vec3 = [0, 40, 0]; // well above fullSpeed → speedScale clamps to 1
const STILL: Vec3 = [0, 0, 0];

describe("sceneryReaction", () => {
  it("is fully at rest when the blob is beyond the reaction radius", () => {
    const far: Vec3 = [DEFAULT_SCENERY_REACTION.radius + 5, 0, 0];
    const r = sceneryReaction(STILL, FAST, far);
    expect(r).toEqual({ influence: 0, lean: 0, pop: 0 });
  });

  it("rises toward full influence as the blob closes in (at matched/over speed)", () => {
    const near: Vec3 = [1, 0, 0]; // 1 unit away, well inside the radius
    const mid: Vec3 = [DEFAULT_SCENERY_REACTION.radius * 0.5, 0, 0];
    const rNear = sceneryReaction(STILL, FAST, near);
    const rMid = sceneryReaction(STILL, FAST, mid);
    expect(rNear.influence).toBeGreaterThan(rMid.influence);
    expect(rNear.influence).toBeGreaterThan(0);
    expect(rNear.influence).toBeLessThanOrEqual(1);
  });

  it("leans the prop AWAY from the blob (three.js +z is CCW, so a rightward tip is −z)", () => {
    // Prop to the blob's RIGHT (dx>0) tips further right = a NEGATIVE z rotation (CCW convention);
    // prop to the LEFT tips left = POSITIVE z. This is the "shoved by the rush of air" feel.
    const right: Vec3 = [2, 0, 0];
    const left: Vec3 = [-2, 0, 0];
    expect(sceneryReaction(STILL, FAST, right).lean).toBeLessThan(0);
    expect(sceneryReaction(STILL, FAST, left).lean).toBeGreaterThan(0);
  });

  it("scales the shove with blob speed — a slow drift-by barely stirs the prop", () => {
    const prop: Vec3 = [2, 0, 0];
    const slow: Vec3 = [0, 2, 0]; // far below fullSpeed
    const fast = sceneryReaction(STILL, FAST, prop);
    const drift = sceneryReaction(STILL, slow, prop);
    expect(drift.influence).toBeGreaterThan(0);
    expect(drift.influence).toBeLessThan(fast.influence);
    expect(Math.abs(drift.lean)).toBeLessThan(Math.abs(fast.lean));
  });

  it("produces no shove when the blob is motionless even right next to a prop", () => {
    const prop: Vec3 = [1, 0, 0];
    const r = sceneryReaction(STILL, STILL, prop);
    expect(r.influence).toBe(0);
    expect(r.lean).toBe(0);
    expect(r.pop).toBe(0);
  });

  it("clamps lean + pop to the configured maxima at point-blank full speed", () => {
    const prop: Vec3 = [0.001, 0, 0]; // essentially on top of the blob, just off-centre for a sign
    const r = sceneryReaction(STILL, FAST, prop);
    expect(Math.abs(r.lean)).toBeLessThanOrEqual(DEFAULT_SCENERY_REACTION.maxLean + 1e-9);
    expect(r.pop).toBeLessThanOrEqual(DEFAULT_SCENERY_REACTION.maxPop + 1e-9);
    expect(r.pop).toBeGreaterThan(0);
  });

  it("ignores the depth (Z) axis — only the X/Y near-miss plane drives the reaction", () => {
    // A prop directly in front/behind the blob (same X/Y, different Z) reacts the same as one at Z=0.
    const atZ0: Vec3 = [2, 0, 0];
    const deepZ: Vec3 = [2, 0, -40];
    const a = sceneryReaction(STILL, FAST, atZ0);
    const b = sceneryReaction(STILL, FAST, deepZ);
    expect(b.influence).toBeCloseTo(a.influence, 10);
    expect(b.lean).toBeCloseTo(a.lean, 10);
  });
});

describe("flybyPeaked", () => {
  it("fires once at the local peak (rising prevPrev<prev, then falling now<prev)", () => {
    // 0.3 → 0.6 → 0.5: just past closest approach → peak.
    expect(flybyPeaked(0.3, 0.6, 0.5)).toBe(true);
  });

  it("does NOT fire while the blob is still approaching (influence rising)", () => {
    expect(flybyPeaked(0.1, 0.3, 0.6)).toBe(false);
  });

  it("does NOT fire on EVERY recession frame — only the peak (the 2-point bug)", () => {
    // Monotonic decline 0.6 → 0.5 → 0.4: prevPrev(0.6) is NOT < prev(0.5), so this mid-recession
    // frame is not a peak. A 2-point `now<prev` test would have wrongly fired here every frame.
    expect(flybyPeaked(0.6, 0.5, 0.4)).toBe(false);
  });

  it("does NOT fire on a faint graze below the minimum peak influence", () => {
    // A real rise→fall, but the peak (prev) never reached minPeakInfluence → no far-edge flourish.
    expect(flybyPeaked(0.03, 0.05, 0.04)).toBe(false);
    expect(DEFAULT_FLYBY_PULSE.minPeakInfluence).toBeGreaterThan(0.05);
  });

  it("does NOT fire on a flat/plateau (equal frames are not a peak)", () => {
    expect(flybyPeaked(0.4, 0.4, 0.4)).toBe(false);
  });
});

describe("stepFlybyPulse", () => {
  it("snaps up to the peak strength on a trigger (fast attack)", () => {
    const v = stepFlybyPulse(0, true, 0.8, 1 / 60);
    expect(v).toBeCloseTo(0.8, 5); // a fresh peak of 0.8 → envelope ~0.8 (minus a frame of decay)
  });

  it("decays toward zero over time when not retriggered (slow decay)", () => {
    let v = stepFlybyPulse(0, true, 1, 1 / 60); // fire at full
    const afterAttack = v;
    for (let i = 0; i < 60; i++) v = stepFlybyPulse(v, false, 0, 1 / 60); // ~1s of decay
    expect(v).toBeLessThan(afterAttack);
    expect(v).toBeLessThan(0.05); // mostly gone after a second at decay 6
    expect(v).toBeGreaterThanOrEqual(0); // never negative
  });

  it("never lifts the envelope ABOVE a peak that is weaker than the current value", () => {
    // Current envelope 0.9 from a recent strong flyby; a new WEAK peak (0.2) must not pull it down.
    const v = stepFlybyPulse(0.9, true, 0.2, 1 / 60);
    expect(v).toBeGreaterThan(0.8); // stays near 0.9 (decayed a frame), not dragged to 0.2
  });

  it("clamps the attack to 1 even for an over-unity peak strength", () => {
    const v = stepFlybyPulse(0, true, 5, 1 / 60);
    expect(v).toBeLessThanOrEqual(1);
  });
});
