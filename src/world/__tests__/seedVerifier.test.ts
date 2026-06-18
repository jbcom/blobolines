import { describe, expect, it } from "vitest";
import { verifySeedRoute } from "../seedVerifier";

describe("seed route verifier", () => {
  it("proves a reported Easy seed through a tall generated tower", () => {
    const report = verifySeedRoute({
      seed: "peppy-coral-noodle",
      difficulty: "ready",
      targetY: 1200,
    });

    expect(report.ok).toBe(true);
    expect(report.seedPhrase).toBe("peppy-coral-noodle");
    expect(report.difficultyLabel).toBe("Easy");
    expect(report.highestY).toBeGreaterThanOrEqual(1200);
    expect(report.pairCount).toBeGreaterThan(80);
    expect(report.minRequiredProofVariants).toBe(2);
    expect(report.maxRequiredProofVariants).toBe(3);
    expect(report.requiredProofVariants).toBe(3);
    expect(report.minProofVariants).toBe(2);
    expect(report.maxProofVariants).toBe(3);
    expect(report.routeGateCount).toBe(0);
    expect(report.phasePortalCount).toBe(0);
    expect(report.minLateralGap).toBeGreaterThanOrEqual(3.4);
    expect(report.minLipClearance).toBeGreaterThanOrEqual(0);
    expect(report.sourceModes.moving).toBeGreaterThan(0);
    expect(report.sourceModes.canted).toBeGreaterThan(0);
    expect(report.sourceModes.wobbler).toBeGreaterThan(0);
    expect(report.failures).toEqual([]);
  });

  it("is deterministic for the same seed phrase and difficulty", () => {
    const a = verifySeedRoute({ seed: "bouncy-bright-blob", difficulty: "hard", targetY: 900 });
    const b = verifySeedRoute({ seed: "bouncy-bright-blob", difficulty: "hard", targetY: 900 });

    expect(b.seed).toBe(a.seed);
    expect(b.highestY).toBe(a.highestY);
    expect(b.padCount).toBe(a.padCount);
    expect(b.minRequiredProofVariants).toBe(1);
    expect(b.maxRequiredProofVariants).toBe(1);
    expect(b.requiredProofVariants).toBe(1);
    expect(b.minProofVariants).toBe(1);
    expect(b.maxProofVariants).toBe(1);
    expect(b.routeGateCount).toBe(a.routeGateCount);
    expect(b.phasePortalCount).toBe(a.phasePortalCount);
    expect(b.minLipClearance).toBe(a.minLipClearance);
    expect(b.sourceModes).toEqual(a.sourceModes);
    expect(b.failures).toEqual([]);
  });

  it("can verify One Wrong Move precision seeds", () => {
    const report = verifySeedRoute({
      seed: "one-path-precision",
      difficulty: "oneWrongMove",
      targetY: 600,
    });

    expect(report.ok).toBe(true);
    expect(report.difficultyLabel).toBe("One Wrong Move");
    expect(report.minRequiredProofVariants).toBe(1);
    expect(report.maxRequiredProofVariants).toBe(1);
    expect(report.requiredProofVariants).toBe(1);
    expect(report.minProofVariants).toBe(1);
    expect(report.maxProofVariants).toBe(1);
    expect(report.routeGateCount).toBeGreaterThan(0);
    expect(report.phasePortalCount).toBe(report.routeGateCount);
    expect(report.minLandingPrecision).toBeGreaterThanOrEqual(0);
  });

  it("rejects invalid verification targets", () => {
    expect(() => verifySeedRoute({ seed: "bad-target", targetY: 0 })).toThrow(
      /targetY must be positive/,
    );
  });
});
