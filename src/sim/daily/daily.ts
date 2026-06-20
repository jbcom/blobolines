import { normalizeSeed } from "@/core/math";
import type { WorldDifficulty } from "@/core/types";

/**
 * Daily-challenge seed + run verification (pure). A "daily" run seeds the world from the
 * calendar date so every player climbs the SAME tower that day — comparable scores. A run hash
 * binds a result to its seed so a leaderboard can detect a score that doesn't match its seed.
 *
 * Pure + date-injected (the caller passes today's Date — sim code never calls `new Date()`, per
 * the determinism rule), so the same date always yields the same seed and a result always hashes
 * the same.
 */

/** Namespace prefix so the daily seed space can't collide with other seed strings. Exported so the
 *  UI can recover a run's date key from its `blobolines-daily-<YYYY-MM-DD>` seed phrase without
 *  re-reading the clock (which would mis-date a run that finishes across UTC midnight). */
export const DAILY_NS = "blobolines-daily";

/** YYYY-MM-DD in UTC for a date — the stable per-day key (UTC so a player's timezone doesn't
 *  shift which "day" they get, and the challenge rolls over at the same instant worldwide). */
export function dailyKey(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Deterministic numeric world seed for a given day (feed to useWorldStore.reset / createRng). */
export function dailySeed(date: Date): number {
  return normalizeSeed(dailySeedPhrase(date));
}

/** Replayable phrase for today's shared challenge. */
export function dailySeedPhrase(date: Date): string {
  return `${DAILY_NS}-${dailyKey(date)}`;
}

/** Whole UTC days from key `a` to key `b` (both YYYY-MM-DD). Positive when b is later. Pure parse —
 *  uses Date.UTC on the parsed parts, not `new Date()`, so it stays deterministic/timezone-free. */
export function daysBetweenKeys(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  const msPerDay = 86_400_000;
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / msPerDay);
}

/** Per-day daily-best scores, keyed by UTC day (YYYY-MM-DD → best composite score that day). Lets a
 *  weekly summary show a trend the top-5 highScores can't (they only keep the 5 best EVER, dropping
 *  most days). Stored on PlayerProgress; pruned to a recent window so it can't grow unbounded. */
export type DailyBests = Record<string, number>;

/** How many recent days the weekly summary + the pruning window span. */
export const WEEK_DAYS = 7;

/** Record a daily run's score into the per-day bests, keeping the BEST score for that day. Pure —
 *  returns a NEW map (never mutates), pruned to entries within WEEK_DAYS of `dayKey` so it stays
 *  bounded. `dayKey` is the run's daily key (the caller passes it; sim never reads the clock). */
export function recordDailyBest(bests: DailyBests, dayKey: string, score: number): DailyBests {
  const next: DailyBests = {};
  // Keep only recent days (within the week window, measured back from this run's day), so old days
  // age out and the map stays small.
  for (const [k, v] of Object.entries(bests)) {
    const age = daysBetweenKeys(k, dayKey);
    if (age >= 0 && age < WEEK_DAYS) next[k] = v;
  }
  next[dayKey] = Math.max(next[dayKey] ?? 0, Math.max(0, Math.floor(score)));
  return next;
}

/** One day in the weekly summary: its key, the player's best score that day (0 if unplayed), and
 *  whether it's the BEST day of the window. */
export interface DailySummaryDay {
  key: string;
  best: number;
  played: boolean;
  isWeekBest: boolean;
}

/** A 7-day daily summary ending at `today`: one entry per day (oldest→newest), the count of days
 *  played, and the best single-day score across the week. Pure + date-injected. */
export interface WeeklyDailySummary {
  days: DailySummaryDay[];
  daysPlayed: number;
  weekBest: number;
}

/** Build the trailing-7-day daily summary from the per-day bests and today's key. Days with no
 *  recorded best read as unplayed (best 0). Pure. */
export function weeklyDailySummary(bests: DailyBests, todayKey: string): WeeklyDailySummary {
  // The week is [today-6 … today]. Compute each day's key from today's parts via Date.UTC, which
  // normalizes an out-of-range day (e.g. day 0 / negative) back across month + year boundaries — pure
  // epoch arithmetic, no clock read. `dailyKey` formats the resulting Date back to YYYY-MM-DD.
  const [ty, tm, td] = todayKey.split("-").map(Number);
  const keyForOffset = (back: number): string =>
    dailyKey(new Date(Date.UTC(ty, tm - 1, td - back)));
  const raw = Array.from({ length: WEEK_DAYS }, (_, i) => {
    const key = keyForOffset(WEEK_DAYS - 1 - i); // oldest first
    const best = bests[key] ?? 0;
    return { key, best, played: best > 0 };
  });
  const weekBest = raw.reduce((m, d) => Math.max(m, d.best), 0);
  const days = raw.map((d) => ({ ...d, isWeekBest: weekBest > 0 && d.best === weekBest }));
  return { days, daysPlayed: days.filter((d) => d.played).length, weekBest };
}

/** Result of advancing the daily streak when a daily run completes on `todayKey`, given the player's
 *  stored `prevStreak` and the `lastKey` they last completed a daily on (empty/undefined = none). */
export interface DailyStreakUpdate {
  /** The new streak length (consecutive UTC days with a completed daily, including today). */
  streak: number;
  /** True when this completion EXTENDED the streak (yesterday → today) — drives a celebratory cue. */
  extended: boolean;
  /** True when a gap broke a prior streak before this one restarted it at 1. */
  brokeStreak: boolean;
}

/**
 * Advance the daily streak (pure). Rules, by the whole-UTC-day gap from the last completed daily to
 * today:
 *  - 0 (already played today): streak unchanged — replaying today's tower doesn't inflate it.
 *  - 1 (yesterday → today): streak + 1 (extended).
 *  - ≥ 2, or no prior daily: streak restarts at 1 (brokeStreak when a prior streak existed).
 * The caller supplies todayKey = dailyKey(today) and the stored prevStreak/lastKey, so this never
 * reads the clock itself.
 */
export function nextDailyStreak(
  prevStreak: number,
  lastKey: string | undefined,
  todayKey: string,
): DailyStreakUpdate {
  if (!lastKey) return { streak: 1, extended: false, brokeStreak: false };
  const gap = daysBetweenKeys(lastKey, todayKey);
  // Same day: already counted today — leave the streak as-is.
  if (gap === 0) return { streak: Math.max(1, prevStreak), extended: false, brokeStreak: false };
  // Yesterday → today: the streak grows.
  if (gap === 1) return { streak: Math.max(1, prevStreak) + 1, extended: true, brokeStreak: false };
  // Any OTHER gap restarts the streak at 1: a missed day (gap ≥ 2), OR a FUTURE lastKey (gap < 0,
  // from a forward clock skew the player later corrected) — a future key must NOT preserve an
  // inflated streak, or the player is silently locked out of extending until wall-clock catches up
  // to the stored future date. The caller overwrites lastDailyKey with todayKey, healing the skew.
  return { streak: 1, extended: false, brokeStreak: prevStreak > 1 };
}

/** The menu's read of the player's daily streak RIGHT NOW (before they play today). Drives the
 *  Daily-Challenge button's streak badge + the "keep it going" nudge. `none` covers no streak at
 *  all. `secured` = today's daily is already in, the streak is safe. `atRisk` = the streak is alive
 *  (last played yesterday) but today isn't done — play to keep it. `expired` = a day was missed, so
 *  the displayed count is stale and the next daily will restart at 1. */
export type DailyStreakState = "none" | "secured" | "atRisk" | "expired";

export interface DailyStreakStatus {
  /** The persisted streak length (what the badge shows). 0 when there's no streak. */
  streak: number;
  state: DailyStreakState;
}

/**
 * Pure: classify the current daily streak for the menu, given the persisted streak/lastKey and
 * today's key. Mirrors nextDailyStreak's gap rules so the menu's preview can never disagree with
 * what the next commit will actually do:
 *  - no streak / no last key → none
 *  - gap 0 (played today) → secured
 *  - gap 1 (played yesterday, not yet today) → atRisk (one play keeps it)
 *  - any other gap (missed day, or a corrected future-clock skew) → expired
 * Date-injected (todayKey from the caller) so it never reads the clock.
 */
export function dailyStreakStatus(
  streak: number,
  lastKey: string | undefined,
  todayKey: string,
): DailyStreakStatus {
  if (streak < 1 || !lastKey) return { streak: 0, state: "none" };
  const gap = daysBetweenKeys(lastKey, todayKey);
  if (gap === 0) return { streak, state: "secured" };
  if (gap === 1) return { streak, state: "atRisk" };
  return { streak, state: "expired" };
}

/** The stats that define a run's outcome (what a leaderboard verifies). */
export interface RunResult {
  seed: number;
  height: number;
  crystals: number;
  maxCombo: number;
  difficulty?: WorldDifficulty;
}

/**
 * A short verification hash binding a run's seed to its result. NOT cryptographic — it's a
 * tamper-evidence checksum for a casual leaderboard (a hand-edited score won't match the hash a
 * fresh replay of the seed would produce). Floors the floats so a hash is stable across the
 * tiny FP noise between a live run and a replay. Returns a base36 string.
 */
export function runHash(result: RunResult): string {
  const canonical = [
    result.seed >>> 0,
    Math.max(0, Math.floor(result.height)),
    Math.max(0, Math.floor(result.crystals)),
    Math.max(0, Math.floor(result.maxCombo)),
    result.difficulty ?? "ready",
  ].join(":");
  return normalizeSeed(`run:${canonical}`).toString(36);
}

/** A high-score row as the daily-standing selector needs to read it — the structural subset of
 *  `HighScoreEntry` (score + which seed it was set on). Kept local + minimal so the pure sim
 *  doesn't depend on the persistence/state layer's full entry shape. */
export interface SeededScore {
  score: number;
  seedPhrase: string;
}

/** Where this run places among the player's OWN prior attempts at today's daily tower. */
export interface DailyStanding {
  /** Total attempts at today's seed INCLUDING this run (always ≥ 1). */
  attemptsToday: number;
  /** 1-based rank of this run's score among today's attempts (1 = best). Ties share the better
   *  rank — two runs at the same top score are both rank 1. */
  rank: number;
  /** True when this run is (tied for) the best the player has done on today's tower. */
  isPersonalDailyBest: boolean;
  /** True when this is the FIRST attempt at today's seed (no prior same-seed entry). */
  isFirstAttempt: boolean;
}

/**
 * Pure daily-results selector: given the player's stored high scores, TODAY's daily seed phrase
 * (the caller derives it from the current date via `dailySeedPhrase` — sim never reads the clock),
 * and the score this run just achieved, report how this run stands against the player's own prior
 * runs ON THE SAME DAILY TOWER. Drives the GameOver "Today's tower" section.
 *
 * `highScores` is assumed to ALREADY include this run (the store commits the run before game-over);
 * if it somehow doesn't, this run is still counted so `attemptsToday`/`rank` stay consistent.
 */
export function dailyStanding(
  highScores: readonly SeededScore[],
  todaySeedPhrase: string,
  thisRunScore: number,
): DailyStanding {
  const todays = highScores.filter((e) => e.seedPhrase === todaySeedPhrase).map((e) => e.score);
  // Count this run even if the caller passed scores that don't yet include it.
  const committed = todays.length;
  const attemptsToday = Math.max(1, committed);
  const isFirstAttempt = committed <= 1;
  // Rank = 1 + how many DISTINCT prior attempts strictly beat this run. Ties share the rank.
  const better = todays.filter((s) => s > thisRunScore).length;
  const rank = better + 1;
  return {
    attemptsToday,
    rank,
    isPersonalDailyBest: rank === 1,
    isFirstAttempt,
  };
}
