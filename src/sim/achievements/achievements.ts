/**
 * Achievements (pure). A small set of milestone goals evaluated against the player's progress
 * + the just-finished run; newly-met ones unlock (persisted) and toast. Definitions + the
 * evaluation are pure data/functions here (deterministic, unit-testable); the store owns the
 * persisted unlocked set and the UI shows the toast/list.
 */

/** The stats an achievement predicate can test: lifetime progress + this run's peaks. */
export interface AchievementStats {
  /** All-time best height (m). */
  bestHeight: number;
  /** All-time best composite score. */
  bestScore: number;
  /** Lifetime crystals collected. */
  lifetimeCrystals: number;
  /** This run's height (m). */
  runHeight: number;
  /** This run's highest combo streak. */
  runMaxCombo: number;
  /** This run's crystals. */
  runCrystals: number;
}

export interface Achievement {
  id: string;
  title: string;
  /** One-line description of the goal. */
  description: string;
  /** Met predicate — pure, over the stats snapshot. */
  met: (s: AchievementStats) => boolean;
}

/** The achievement set. Ordered roughly by difficulty for a tidy list. Add freely — the store
 *  keys the unlocked set by `id`, so reordering/adding never disturbs existing unlocks. */
export const ACHIEVEMENTS: readonly Achievement[] = [
  {
    id: "height-100",
    title: "Cloud Niner",
    description: "Reach 100 m in a single run.",
    met: (s) => s.bestHeight >= 100,
  },
  {
    id: "height-250",
    title: "Stratosphere",
    description: "Reach 250 m in a single run.",
    met: (s) => s.bestHeight >= 250,
  },
  {
    id: "height-500",
    title: "Low Orbit",
    description: "Reach 500 m in a single run.",
    met: (s) => s.bestHeight >= 500,
  },
  {
    id: "combo-5",
    title: "On a Roll",
    description: "Chain a 5× clean-bounce combo.",
    met: (s) => s.runMaxCombo >= 5,
  },
  {
    id: "combo-8",
    title: "Unbreakable",
    description: "Chain an 8× clean-bounce combo.",
    met: (s) => s.runMaxCombo >= 8,
  },
  {
    id: "crystals-run-25",
    title: "Magpie",
    description: "Collect 25 crystals in one run.",
    met: (s) => s.runCrystals >= 25,
  },
  {
    id: "crystals-total-250",
    title: "Hoarder",
    description: "Collect 250 crystals all-time.",
    met: (s) => s.lifetimeCrystals >= 250,
  },
  {
    id: "score-10k",
    title: "High Roller",
    description: "Post a 10,000-point run.",
    met: (s) => s.bestScore >= 10000,
  },
];

const BY_ID: Record<string, Achievement> = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));

/** Look up an achievement definition by id (undefined if unknown). */
export function achievementById(id: string): Achievement | undefined {
  return BY_ID[id];
}

/**
 * Evaluate the achievement set against a stats snapshot and the already-unlocked ids; return
 * the ids NEWLY met this evaluation (not previously unlocked). Pure — the caller persists the
 * union and toasts the new ones.
 */
export function newlyUnlocked(stats: AchievementStats, unlocked: readonly string[]): string[] {
  const have = new Set(unlocked);
  const fresh: string[] = [];
  for (const a of ACHIEVEMENTS) {
    if (!have.has(a.id) && a.met(stats)) fresh.push(a.id);
  }
  return fresh;
}
