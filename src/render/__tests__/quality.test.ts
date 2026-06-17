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

  it("pool sizes + segments scale up with tier", () => {
    expect(resolveQuality("phone", 20).maxDroplets).toBeLessThan(
      resolveQuality("desktop").maxDroplets,
    );
    expect(resolveQuality("phone", 20).blobSegments).toBeLessThan(
      resolveQuality("desktop").blobSegments,
    );
  });
});
