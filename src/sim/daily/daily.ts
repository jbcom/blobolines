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
