import { describe, expect, it } from "vitest";
import { createRng } from "@/core/math";
import { generateUpTo, starterPad } from "../generator";
import { reaches } from "../reachable";

/**
 * The CLIMB PROOF — the playability safety net the navigability work exists to guarantee.
 *
 * Every consecutive pad pair must have a visible passive parabola, stored on the source pad
 * as `goldenPath`. The dev harness renders these exact samples in red for screenshot proof.
 */

function fullTower(seed: string | number, targetY: number) {
  const start = starterPad();
  const chunk = generateUpTo(createRng(seed), 0, targetY, start);
  return [start, ...chunk.trampolines];
}

function expectCertifiedPair(
  a: ReturnType<typeof starterPad>,
  b: ReturnType<typeof starterPad>,
  label: string,
) {
  const proof = a.goldenPath;
  expect(proof, `${label}: missing stored goldenPath`).toBeDefined();
  expect(proof?.toPadId, `${label}: proof points at wrong successor`).toBe(b.id);
  expect(proof?.samples.length, `${label}: proof needs visible samples`).toBeGreaterThan(12);
  expect(proof?.clearance, `${label}: proof lands outside target footprint`).toBeGreaterThanOrEqual(
    0,
  );
  expect(proof?.apex[1], `${label}: apex must clear the successor`).toBeGreaterThanOrEqual(
    b.position[1],
  );
  expect(reaches(a, b), `${label}: solveGoldenPath predicate failed`).toBe(true);
}

describe("tower is climbable (golden-path proof)", () => {
  it("canted pads carry aimed, varied route proofs", () => {
    const pads = fullTower("climb", 400);
    let cantedPairs = 0;
    const angles = new Set<string>();
    for (let i = 0; i < pads.length - 1; i++) {
      const a = pads[i];
      if (a.type !== "canted") continue;
      cantedPairs++;
      const b = pads[i + 1];
      expectCertifiedPair(a, b, `canted pad #${i}`);
      expect(a.goldenPath?.requiredCant).toBe(true);
      expect(a.goldenPath?.sourceMode).toBe("canted");
      expect(a.goldenPath?.launchAngleRad).toBeGreaterThan(0.25);
      angles.add(a.goldenPath?.launchAngleRad.toFixed(2) ?? "missing");
    }
    expect(cantedPairs).toBeGreaterThan(0);
    expect(angles.size).toBeGreaterThan(1);
  });

  it("moving and wobbler pads also store playable proof arcs", () => {
    const pads = fullTower("special-route", 300);
    const sourceModes = new Set<string>();
    for (let i = 0; i < pads.length - 1; i++) {
      const a = pads[i];
      if (a.type !== "moving" && a.type !== "wobbler") continue;
      expectCertifiedPair(a, pads[i + 1], `${a.type} pad #${i}`);
      sourceModes.add(a.goldenPath?.sourceMode ?? "missing");
      if (a.type === "moving") expect(a.moveAxis).toBeDefined();
    }
    expect(sourceModes.has("moving")).toBe(true);
    expect(sourceModes.has("wobbler")).toBe(true);
  });

  it("the whole chain stores end-to-end visible parabolas", () => {
    const pads = fullTower("endtoend", 500);
    for (let i = 0; i < pads.length - 1; i++) {
      expectCertifiedPair(pads[i], pads[i + 1], `pad #${i}`);
      expect(pads[i].goldenPath?.landingPrecision).toBeGreaterThanOrEqual(0);
      expect(pads[i].goldenPath?.landingPrecision).toBeLessThanOrEqual(1);
      expect(pads[i].goldenPath?.lipClearance).toBeGreaterThanOrEqual(0);
      expect(pads[i].goldenPath?.arcCompression).toBeGreaterThanOrEqual(0);
      expect(pads[i].goldenPath?.arcCompression).toBeLessThanOrEqual(1);
    }
  });

  it("holds across many seeds (the guarantee isn't seed-luck)", () => {
    for (const seed of ["a", "b", "c", "d", "e"]) {
      const pads = fullTower(seed, 300);
      for (let i = 0; i < pads.length - 1; i++) {
        expectCertifiedPair(pads[i], pads[i + 1], `seed ${seed}: pad #${i}`);
      }
    }
  });

  it("EVERY pad is certified across 60 seeds up to a tall tower", () => {
    let pairsChecked = 0;
    for (let s = 0; s < 60; s++) {
      const pads = fullTower(`sweep-${s}`, 700);
      for (let i = 0; i < pads.length - 1; i++) {
        pairsChecked++;
        expectCertifiedPair(pads[i], pads[i + 1], `seed sweep-${s}: pad #${i}`);
      }
    }
    expect(pairsChecked).toBeGreaterThan(2000);
  });
});
