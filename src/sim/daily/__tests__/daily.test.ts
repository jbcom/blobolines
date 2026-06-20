import { describe, expect, it } from "vitest";
import {
  dailyKey,
  dailySeed,
  dailySeedPhrase,
  dailyStanding,
  daysBetweenKeys,
  nextDailyStreak,
  runHash,
  type SeededScore,
} from "../daily";

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
    expect(dailySeedPhrase(jun16)).toBe("blobolines-daily-2026-06-16");
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
    expect(runHash({ ...base, difficulty: "blobmare" })).not.toBe(h);
  });

  it("runHash is a compact base36 string", () => {
    expect(runHash({ seed: 1, height: 1, crystals: 0, maxCombo: 0 })).toMatch(/^[0-9a-z]+$/);
  });
});

describe("dailyStanding", () => {
  const TODAY = dailySeedPhrase(jun16); // blobolines-daily-2026-06-16
  const OTHER = dailySeedPhrase(jun17); // a different day's tower
  const RANDOM = "lemon-otter-77"; // a non-daily random run

  const row = (score: number, seedPhrase: string): SeededScore => ({ score, seedPhrase });

  it("first attempt on today's tower → rank 1, personal best, first-attempt flagged", () => {
    // highScores already includes this run (the store commits before game-over): exactly one today.
    const s = dailyStanding([row(1200, TODAY)], TODAY, 1200);
    expect(s).toEqual({
      attemptsToday: 1,
      rank: 1,
      isPersonalDailyBest: true,
      isFirstAttempt: true,
    });
  });

  it("a repeat attempt that beats the prior best is rank 1 of N", () => {
    // Two prior runs (900, 1500) + this run (2000) all on today's seed.
    const scores = [row(900, TODAY), row(1500, TODAY), row(2000, TODAY)];
    const s = dailyStanding(scores, TODAY, 2000);
    expect(s.attemptsToday).toBe(3);
    expect(s.rank).toBe(1);
    expect(s.isPersonalDailyBest).toBe(true);
    expect(s.isFirstAttempt).toBe(false);
  });

  it("a worse repeat attempt ranks below the better prior runs", () => {
    const scores = [row(2500, TODAY), row(1800, TODAY), row(1000, TODAY)];
    const s = dailyStanding(scores, TODAY, 1000);
    expect(s.attemptsToday).toBe(3);
    expect(s.rank).toBe(3); // two prior runs beat 1000
    expect(s.isPersonalDailyBest).toBe(false);
  });

  it("ties share the better rank (two top scores are both rank 1)", () => {
    const scores = [row(2000, TODAY), row(2000, TODAY)];
    const s = dailyStanding(scores, TODAY, 2000);
    expect(s.rank).toBe(1); // no STRICTLY-better run exists
    expect(s.isPersonalDailyBest).toBe(true);
    expect(s.attemptsToday).toBe(2);
  });

  it("ignores runs from other days and random (non-daily) seeds", () => {
    const scores = [
      row(9999, OTHER), // yesterday/tomorrow's tower — must not count
      row(8888, RANDOM), // a random run — must not count
      row(1200, TODAY),
    ];
    const s = dailyStanding(scores, TODAY, 1200);
    expect(s.attemptsToday).toBe(1); // only the one TODAY entry
    expect(s.rank).toBe(1);
    expect(s.isFirstAttempt).toBe(true);
  });

  it("still counts this run when highScores has not yet recorded it (defensive)", () => {
    // No TODAY entry committed yet — the selector must not report 0 attempts or rank 0.
    const s = dailyStanding([row(500, RANDOM)], TODAY, 1500);
    expect(s.attemptsToday).toBe(1);
    expect(s.rank).toBe(1);
    expect(s.isFirstAttempt).toBe(true);
  });
});

describe("daysBetweenKeys", () => {
  it("counts whole UTC days between two YYYY-MM-DD keys", () => {
    expect(daysBetweenKeys("2026-06-16", "2026-06-17")).toBe(1);
    expect(daysBetweenKeys("2026-06-16", "2026-06-16")).toBe(0);
    expect(daysBetweenKeys("2026-06-16", "2026-06-20")).toBe(4);
    expect(daysBetweenKeys("2026-06-17", "2026-06-16")).toBe(-1); // later→earlier is negative
  });

  it("spans month + year boundaries correctly", () => {
    expect(daysBetweenKeys("2026-06-30", "2026-07-01")).toBe(1);
    expect(daysBetweenKeys("2026-12-31", "2027-01-01")).toBe(1);
    expect(daysBetweenKeys("2024-02-28", "2024-03-01")).toBe(2); // 2024 leap year (Feb 29)
  });
});

describe("nextDailyStreak", () => {
  it("starts a streak at 1 on the first ever daily (no prior key)", () => {
    const u = nextDailyStreak(0, undefined, "2026-06-20");
    expect(u).toEqual({ streak: 1, extended: false, brokeStreak: false });
  });

  it("EXTENDS the streak when the last daily was yesterday", () => {
    const u = nextDailyStreak(3, "2026-06-19", "2026-06-20");
    expect(u).toEqual({ streak: 4, extended: true, brokeStreak: false });
  });

  it("leaves the streak unchanged when replaying TODAY (already counted)", () => {
    const u = nextDailyStreak(4, "2026-06-20", "2026-06-20");
    expect(u).toEqual({ streak: 4, extended: false, brokeStreak: false });
  });

  it("RESETS to 1 and flags brokeStreak when a day was missed", () => {
    const u = nextDailyStreak(5, "2026-06-17", "2026-06-20"); // 3-day gap
    expect(u).toEqual({ streak: 1, extended: false, brokeStreak: true });
  });

  it("resets to 1 WITHOUT brokeStreak when there was no real streak to break", () => {
    const u = nextDailyStreak(1, "2026-06-17", "2026-06-20");
    expect(u).toEqual({ streak: 1, extended: false, brokeStreak: false });
  });

  it("never returns a streak below 1 even from a corrupt 0 prev on a same-day replay", () => {
    expect(nextDailyStreak(0, "2026-06-20", "2026-06-20").streak).toBe(1);
  });

  it("treats a FUTURE lastKey (forward clock skew) as a missed day — resets, no inflated streak", () => {
    // lastKey is days AHEAD of today (a player set the clock forward, played, then corrected it). The
    // streak must NOT be preserved (that would lock them out of extending until wall-clock catches up).
    const u = nextDailyStreak(5, "2026-06-25", "2026-06-20"); // gap = -5
    expect(u).toEqual({ streak: 1, extended: false, brokeStreak: true });
  });
});
