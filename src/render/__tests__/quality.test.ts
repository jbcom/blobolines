import { describe, expect, it } from "vitest";
import { resolveQuality, tierForDevice } from "../quality";

describe("quality tiers", () => {
  it("maps device classes to a starting tier (desktop high, others medium)", () => {
    expect(tierForDevice("desktop")).toBe("high");
    expect(tierForDevice("tablet")).toBe("medium");
    expect(tierForDevice("phone")).toBe("medium");
  });

  it("high tier (desktop) enables the heavy effects; low tier disables them", () => {
    const high = resolveQuality("desktop");
    expect(high.tier).toBe("high");
    expect(high.refraction).toBe(true);
    expect(high.dof).toBe(true);
    expect(high.godRays).toBe(true);

    const low = resolveQuality("phone", 20); // sustained low FPS drops a phone to low
    expect(low.tier).toBe("low");
    expect(low.refraction).toBe(false);
    expect(low.dof).toBe(false);
    expect(low.godRays).toBe(false);
  });

  it("never enables refraction below high tier", () => {
    for (const t of [
      resolveQuality("tablet"),
      resolveQuality("phone"),
      resolveQuality("phone", 18),
    ]) {
      expect(t.refraction).toBe(false);
    }
  });

  it("a sustained low FPS downgrades the tier", () => {
    expect(resolveQuality("desktop").tier).toBe("high");
    expect(resolveQuality("desktop", 28).tier).toBe("medium"); // <30 → drop one
    expect(resolveQuality("desktop", 20).tier).toBe("low"); // <24 → drop to low
  });

  it("a healthy FPS never upgrades past the device's starting tier", () => {
    // A fast phone stays medium — it doesn't get desktop-only heavy passes.
    expect(resolveQuality("phone", 60).tier).toBe("medium");
    expect(resolveQuality("phone", 60).refraction).toBe(false);
  });

  it("no FPS measurement → just the device tier", () => {
    expect(resolveQuality("tablet", 0).tier).toBe("medium");
  });

  it("low strips bloom + chromatic + MSAA and clamps DPR; high keeps them", () => {
    const low = resolveQuality("phone", 20); // → low
    expect(low.tier).toBe("low");
    expect(low.bloom).toBe(0); // bloom pass dropped entirely
    expect(low.chroma).toBe(false); // chromatic-aberration pass dropped
    expect(low.antialias).toBe(false); // no MSAA
    expect(low.maxDpr).toBeLessThanOrEqual(1.5);

    const high = resolveQuality("desktop");
    expect(high.bloom).toBeGreaterThan(0);
    expect(high.chroma).toBe(true);
    expect(high.antialias).toBe(true);
    expect(high.maxDpr).toBe(2);
    // Per-pad splat texture is halved on low vs high.
    expect(low.splatResolution).toBeLessThan(high.splatResolution);
    expect(high.splatResolution).toBe(128);
  });

  it("DPR cap never decreases as the tier increases", () => {
    expect(resolveQuality("phone", 20).maxDpr).toBeLessThanOrEqual(
      resolveQuality("desktop").maxDpr,
    );
  });

  it("pool sizes + segments scale up with tier", () => {
    expect(resolveQuality("phone", 20).maxDroplets).toBeLessThan(
      resolveQuality("desktop").maxDroplets,
    );
    expect(resolveQuality("phone", 20).blobSegments).toBeLessThan(
      resolveQuality("desktop").blobSegments,
    );
  });

  it('"auto" pref runs the device+FPS heuristic (unchanged default behavior)', () => {
    expect(resolveQuality("desktop", 0, "auto").tier).toBe("high");
    expect(resolveQuality("desktop", 20, "auto").tier).toBe("low"); // heuristic still downgrades
  });

  it("an explicit pref PINS the tier, overriding device + FPS", () => {
    // A phone forced to high gets the heavy effects even though its device tier is medium.
    const forcedHigh = resolveQuality("phone", 60, "high");
    expect(forcedHigh.tier).toBe("high");
    expect(forcedHigh.refraction).toBe(true);
    // A fast desktop forced to low gets the low tier even with a great FPS.
    const forcedLow = resolveQuality("desktop", 120, "low");
    expect(forcedLow.tier).toBe("low");
    expect(forcedLow.refraction).toBe(false);
    // Pinned tiers ignore the FPS evidence entirely.
    expect(resolveQuality("desktop", 10, "high").tier).toBe("high");
  });
});
