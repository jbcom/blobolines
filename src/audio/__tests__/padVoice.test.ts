import { describe, expect, it } from "vitest";
import type { TrampType } from "@/core/types";
import { padVoice } from "../padVoice";

const ALL: TrampType[] = [
  "standard",
  "booster",
  "super",
  "moving",
  "canted",
  "wobbler",
  "fragile",
  "ice",
];

describe("padVoice", () => {
  it("gives every pad type a defined voice (sample + finite rate + finite volume)", () => {
    for (const t of ALL) {
      const v = padVoice(t, 1);
      expect(["bounce", "bounce_soft", "bounce_ice"]).toContain(v.sample);
      expect(Number.isFinite(v.rate)).toBe(true);
      expect(v.rate).toBeGreaterThan(0);
      expect(v.volume).toBeGreaterThan(0);
    }
  });

  it("ice + fragile keep their dedicated samples; the rest reuse the punchy bounce", () => {
    expect(padVoice("ice").sample).toBe("bounce_ice");
    expect(padVoice("fragile").sample).toBe("bounce_soft");
    for (const t of [
      "standard",
      "booster",
      "super",
      "moving",
      "canted",
      "wobbler",
    ] as TrampType[]) {
      expect(padVoice(t).sample).toBe("bounce");
    }
  });

  it("pads sound DISTINCT — booster brighter than super (rate ordering)", () => {
    // Super is the heavy low-pitched mega-pad; booster the springy bright one.
    expect(padVoice("super").rate).toBeLessThan(padVoice("standard").rate);
    expect(padVoice("booster").rate).toBeGreaterThan(padVoice("standard").rate);
    // Super lands loudest (it's the treat).
    expect(padVoice("super").volume).toBeGreaterThan(padVoice("standard").volume);
  });

  it("a harder impact brightens the pitch + lifts the volume", () => {
    const soft = padVoice("standard", 0);
    const hard = padVoice("standard", 1);
    expect(hard.rate).toBeGreaterThan(soft.rate);
    expect(hard.volume).toBeGreaterThan(soft.volume);
  });

  it("clamps out-of-range strength (never NaN / runaway)", () => {
    const lo = padVoice("standard", -5);
    const hi = padVoice("standard", 99);
    expect(lo.rate).toBeCloseTo(padVoice("standard", 0).rate, 6);
    expect(hi.rate).toBeCloseTo(padVoice("standard", 1).rate, 6);
  });
});
