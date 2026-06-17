import { describe, expect, it } from "vitest";
import { dailyKey, dailySeed, runHash } from "../daily";

// Fixed UTC dates (date is injected — sim never calls new Date()).
const jun16 = new Date(Date.UTC(2026, 5, 16, 9, 30)); // month is 0-based → June
const jun16Late = new Date(Date.UTC(2026, 5, 16, 23, 59));
const jun17 = new Date(Date.UTC(2026, 5, 17, 0, 1));

describe("daily challenge", () => {
  it("dailyKey is the UTC YYYY-MM-DD, stable across the same day's clock times", () => {
    expect(dailyKey(jun16)).toBe("2026-06-16");
    expect(dailyKey(jun16Late)).toBe("2026-06-16"); // same UTC day → same key
    expect(dailyKey(jun17)).toBe("2026-06-17");
  });

  it("dailySeed is deterministic per day and differs across days", () => {
    expect(dailySeed(jun16)).toBe(dailySeed(jun16Late)); // same day → same seed
    expect(dailySeed(jun16)).not.toBe(dailySeed(jun17)); // different day → different seed
    expect(Number.isInteger(dailySeed(jun16))).toBe(true);
    expect(dailySeed(jun16)).toBeGreaterThanOrEqual(0); // u32
  });

  it("runHash is deterministic for the same result and tolerant of FP noise", () => {
    const a = runHash({ seed: 42, height: 128.0, crystals: 7, maxCombo: 5 });
    const b = runHash({ seed: 42, height: 128.4, crystals: 7, maxCombo: 5 }); // floors → same
    expect(a).toBe(b);
  });

  it("runHash changes when any result field changes (tamper-evident)", () => {
    const base = { seed: 42, height: 128, crystals: 7, maxCombo: 5 };
    const h = runHash(base);
    expect(runHash({ ...base, seed: 43 })).not.toBe(h);
    expect(runHash({ ...base, height: 200 })).not.toBe(h);
    expect(runHash({ ...base, crystals: 8 })).not.toBe(h);
    expect(runHash({ ...base, maxCombo: 6 })).not.toBe(h);
  });

  it("runHash is a compact base36 string", () => {
    expect(runHash({ seed: 1, height: 1, crystals: 0, maxCombo: 0 })).toMatch(/^[0-9a-z]+$/);
  });
});
