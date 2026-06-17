import { afterEach, describe, expect, it } from "vitest";
import { applyQuality, getQuality, setQualityPref } from "../qualityBridge";

// Restore the default "auto" pref after each test so the shared module state doesn't leak.
afterEach(() => setQualityPref("auto"));

describe("qualityBridge", () => {
  it("setQualityPref pins the tier and getQuality reflects it immediately", () => {
    setQualityPref("low");
    expect(getQuality().tier).toBe("low");
    setQualityPref("high");
    expect(getQuality().tier).toBe("high");
    expect(getQuality().refraction).toBe(true); // high enables the heavy effects
  });

  it("a pinned pref survives a later applyQuality(fps) — the override wins over FPS", () => {
    setQualityPref("high");
    // Even a terrible FPS must not downgrade a pinned-high tier (auto would drop to low here).
    applyQuality(10);
    expect(getQuality().tier).toBe("high");
  });

  it('"auto" lets applyQuality(fps) drive the tier again', () => {
    setQualityPref("auto");
    applyQuality(10); // sustained low FPS → downgrades under the auto heuristic
    expect(getQuality().tier).toBe("low");
  });
});
