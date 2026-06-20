import { describe, expect, it } from "vitest";
import { MILESTONE_TIER_COUNT } from "@/audio";
import { milestoneVisual } from "../milestoneVisual";

describe("milestoneVisual", () => {
  it("covers exactly every audio milestone tier (no missing/extra visual tier)", () => {
    // The module throws at load if the counts mismatch; assert the contract here too so the reason
    // is explicit. Each tier index 0..count-1 yields a distinct, fully-formed visual.
    for (let i = 0; i < MILESTONE_TIER_COUNT; i++) {
      const v = milestoneVisual(i);
      expect(v.label.length, `tier ${i} label`).toBeGreaterThan(0);
      expect(v.flash).toBeGreaterThanOrEqual(0);
      expect(v.flash).toBeLessThanOrEqual(1);
      expect(v.scale).toBeGreaterThan(0);
    }
  });

  it("escalates with the tier — higher tiers flash brighter and pop bigger", () => {
    const base = milestoneVisual(0);
    const top = milestoneVisual(MILESTONE_TIER_COUNT - 1);
    expect(base.flash, "the base tier is calm (no flash)").toBe(0);
    expect(top.flash).toBeGreaterThan(base.flash);
    expect(top.scale).toBeGreaterThan(base.scale);
    // The labels are distinct across tiers (each milestone tier reads as its own celebration).
    const labels = Array.from({ length: MILESTONE_TIER_COUNT }, (_, i) => milestoneVisual(i).label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("clamps an out-of-range index to the nearest real tier (never undefined)", () => {
    expect(milestoneVisual(-1)).toEqual(milestoneVisual(0));
    expect(milestoneVisual(999)).toEqual(milestoneVisual(MILESTONE_TIER_COUNT - 1));
  });
});
