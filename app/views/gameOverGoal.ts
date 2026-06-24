import { ACHIEVEMENTS, type AchievementStats, achievementProgress } from "@/sim/achievements";

export interface NextClimbGoal {
  title: string;
  description: string;
  progressText: string;
  progressPct: number;
  ariaLabel: string;
}

export interface NextClimbGoalInput {
  stats: AchievementStats;
  unlockedAchievements: readonly string[];
  dailyRun: boolean;
}

function formatNumber(n: number): string {
  return Math.floor(n).toLocaleString();
}

function progressText(id: string, current: number, target: number): string {
  if (id.startsWith("height-")) return `${formatNumber(current)} / ${formatNumber(target)} m`;
  if (id.startsWith("score-")) return `${formatNumber(current)} / ${formatNumber(target)} pts`;
  if (id.startsWith("combo-"))
    return `${formatNumber(current)} / ${formatNumber(target)} clean combo`;
  if (id === "crystals-run-25") {
    return `${formatNumber(current)} / ${formatNumber(target)} crystals this run`;
  }
  if (id.startsWith("crystals-total-")) {
    return `${formatNumber(current)} / ${formatNumber(target)} lifetime crystals`;
  }
  if (id.startsWith("daily-streak-")) {
    return `${formatNumber(current)} / ${formatNumber(target)} day streak`;
  }
  return `${formatNumber(current)} / ${formatNumber(target)}`;
}

/**
 * Pick the most relevant next post-run goal from the achievement set. The GameOver card already
 * explains what happened; this gives the next run a single clear target without adding new state.
 */
export function nextClimbGoal({
  stats,
  unlockedAchievements,
  dailyRun,
}: NextClimbGoalInput): NextClimbGoal {
  const unlocked = new Set(unlockedAchievements);
  const candidates = ACHIEVEMENTS.map((achievement, index) => {
    const progress = achievementProgress(achievement, stats);
    return { achievement, progress, index };
  }).filter(({ achievement, progress }) => {
    if (unlocked.has(achievement.id)) return false;
    if (progress.fraction >= 1) return false;
    if (achievement.id.startsWith("daily-streak-") && !dailyRun) return false;
    return true;
  });

  const chosen = [...candidates].sort((a, b) => {
    const progressDelta = b.progress.fraction - a.progress.fraction;
    return Math.abs(progressDelta) > 0.001 ? progressDelta : a.index - b.index;
  })[0];

  if (!chosen) {
    const score = formatNumber(stats.bestScore);
    const height = formatNumber(stats.bestHeight);
    return {
      title: "Raise the record",
      description: "All listed milestones are cleared.",
      progressText: `${height} m best · ${score} best score`,
      progressPct: 100,
      ariaLabel: `Next climb goal: raise the record. Current best is ${height} metres and ${score} points.`,
    };
  }

  const text = progressText(chosen.achievement.id, chosen.progress.current, chosen.progress.target);

  return {
    title: chosen.achievement.title,
    description: chosen.achievement.description,
    progressText: text,
    progressPct: Math.floor(chosen.progress.fraction * 100),
    ariaLabel: `Next climb goal: ${chosen.achievement.title}. ${text}.`,
  };
}
