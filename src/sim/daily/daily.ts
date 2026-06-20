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

/** Namespace prefix so the daily seed space can't collide with other seed strings. */
const DAILY_NS = "blobolines-daily";

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
