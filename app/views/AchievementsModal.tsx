import {
  Button,
  Dialog,
  Progress,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@app/components/ui";
import {
  Activity,
  Award,
  CalendarDays,
  Crown,
  Flame,
  Gem,
  Lock,
  Rocket,
  Sparkles,
  Star,
  Trophy,
  Zap,
} from "lucide-react";
import { ACHIEVEMENTS, type AchievementStats, achievementProgress } from "@/sim/achievements";
import { useGameStore } from "@/state";

// Map achievement IDs to high-quality Lucide icons for high-fidelity aesthetics
const ACHIEVEMENT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  "height-100": Star,
  "height-250": Award,
  "height-500": Trophy,
  "height-1000": Rocket,
  "combo-5": Flame,
  "combo-8": Zap,
  "crystals-run-25": Gem,
  "crystals-total-250": Sparkles,
  "crystals-total-500": Sparkles,
  "score-10k": Crown,
  "score-25k": Trophy,
};

export function AchievementsModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const progress = useGameStore((s) => s.progress);
  const highScores = progress.highScores ?? [];
  const unlockedAchievements = progress.unlockedAchievements ?? [];

  // All-time stats snapshot for the LOCKED-achievement progress bars. The modal opens from the menu,
  // so there's no live run — the per-run axes (a run's combo/crystals) read 0, and the all-time axes
  // (best height/score, lifetime crystals) carry the real progress the bars show.
  const stats: AchievementStats = {
    bestHeight: progress.bestHeight,
    bestScore: progress.bestScore,
    lifetimeCrystals: progress.crystals,
    runHeight: 0,
    runMaxCombo: 0,
    runCrystals: 0,
  };

  const unlockedCount = unlockedAchievements.length;
  const totalCount = ACHIEVEMENTS.length;
  const unlockPercentage = totalCount > 0 ? (unlockedCount / totalCount) * 100 : 0;

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      if (Number.isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    } catch {
      return dateStr;
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      ariaLabel="Achievements & Leaderboard"
      testId="achievements-modal"
    >
      <div className="flex flex-col gap-4">
        {/* Header Title */}
        <div className="flex items-center gap-3">
          <div
            className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-tramp-gold/30 bg-tramp-gold/10 text-tramp-gold shadow-[0_0_15px_rgba(242,193,78,0.15)]"
            aria-hidden
          >
            <Trophy className="size-5 animate-pulse" />
          </div>
          <div>
            <h2 className="font-display text-2xl font-bold text-cream">Hall of Fame</h2>
            <p className="font-ui text-xs text-fg-subtle">
              Your proudest milestones and legendary climbs.
            </p>
          </div>
        </div>

        {/* Tabs System */}
        <Tabs defaultValue="achievements" className="mt-2 w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="achievements">Achievements</TabsTrigger>
            <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
          </TabsList>

          {/* 1. Achievements Tab */}
          <TabsContent value="achievements" className="mt-4 flex flex-col gap-4">
            {/* Completion Progress Card */}
            <div className="rounded-xl border border-border/40 bg-surface/30 p-4">
              <div className="flex items-center justify-between text-sm font-semibold">
                <span className="font-display text-cream">Medals Unlocked</span>
                <span className="font-display text-tramp-gold tabular-nums">
                  {unlockedCount} / {totalCount}
                </span>
              </div>
              <Progress value={unlockPercentage} className="mt-2 h-2.5 bg-bg/60" />
            </div>

            {/* Achievement Grid */}
            <div className="grid grid-cols-1 gap-3 max-h-[300px] overflow-y-auto pr-1 sm:grid-cols-2">
              {ACHIEVEMENTS.map((ach) => {
                const isUnlocked = unlockedAchievements.includes(ach.id);
                const IconComponent = ACHIEVEMENT_ICONS[ach.id] || Award;

                return (
                  <div
                    key={ach.id}
                    className={`group relative flex items-start gap-3 rounded-xl border p-3 transition-all duration-200 ${
                      isUnlocked
                        ? "border-tramp-gold/30 bg-tramp-gold/5 shadow-[0_0_12px_rgba(242,193,78,0.05)] hover:border-tramp-gold/50"
                        : "border-border/40 bg-bg/20 opacity-60"
                    }`}
                  >
                    {/* Icon container */}
                    <div
                      className={`flex size-9 shrink-0 items-center justify-center rounded-lg border transition-transform duration-300 group-hover:scale-105 ${
                        isUnlocked
                          ? "border-tramp-gold/20 bg-tramp-gold/10 text-tramp-gold"
                          : "border-border/20 bg-border/10 text-fg-subtle"
                      }`}
                    >
                      {isUnlocked ? (
                        <IconComponent className="size-5" />
                      ) : (
                        <Lock className="size-4" />
                      )}
                    </div>

                    {/* Metadata text */}
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span
                        className={`font-display text-sm font-bold tracking-wide transition-colors ${
                          isUnlocked ? "text-cream group-hover:text-tramp-gold" : "text-fg-muted"
                        }`}
                      >
                        {ach.title}
                      </span>
                      <span className="mt-0.5 font-ui text-[11px] leading-normal text-fg-subtle">
                        {ach.description}
                      </span>
                      {/* Locked → show how close you are, but ONLY for partial progress (0 < f < 1):
                          a fresh run-only medal at 0 would read as a stalled bar, and a medal whose
                          stat already meets the target (f≥1) is pending commit on the next run-end —
                          a full bar on a "locked" medal would confuse, so suppress it there too. */}
                      {!isUnlocked &&
                        (() => {
                          const p = achievementProgress(ach, stats);
                          if (p.fraction <= 0 || p.fraction >= 1) return null;
                          return (
                            <div className="mt-1.5 flex flex-col gap-0.5">
                              <div className="h-1 w-full overflow-hidden rounded-full bg-border/30">
                                <div
                                  className="h-full rounded-full bg-tramp-gold/60"
                                  style={{ width: `${Math.round(p.fraction * 100)}%` }}
                                />
                              </div>
                              <span className="font-ui text-[10px] tabular-nums text-fg-subtle">
                                {Math.floor(p.current).toLocaleString()} /{" "}
                                {p.target.toLocaleString()}
                              </span>
                            </div>
                          );
                        })()}
                    </div>

                    {/* Unlocked tag corner */}
                    {isUnlocked && (
                      <span className="absolute right-2 top-2 size-1.5 rounded-full bg-tramp-gold shadow-[0_0_6px_#f2c14e]" />
                    )}
                  </div>
                );
              })}
            </div>
          </TabsContent>

          {/* 2. Leaderboard Tab */}
          <TabsContent value="leaderboard" className="mt-4 flex flex-col gap-3">
            {highScores.length === 0 ? (
              /* Beautiful Empty State */
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-bg/10 py-12 text-center">
                <Activity className="size-10 text-fg-subtle/50 animate-pulse" />
                <h3 className="mt-4 font-display text-base font-bold text-cream">
                  No climbs recorded yet
                </h3>
                <p className="mt-1 max-w-[280px] font-ui text-xs text-fg-subtle">
                  Launch a high-altitude climb to see your personal bests ranked on this list!
                </p>
              </div>
            ) : (
              /* High Score List */
              <div className="flex flex-col gap-2 max-h-[360px] overflow-y-auto pr-1">
                {highScores.map((score, index) => {
                  const rank = index + 1;
                  const isPodium = rank <= 3;
                  const rankStyles = [
                    "bg-tramp-gold/20 text-tramp-gold border-tramp-gold/40 shadow-[0_0_8px_rgba(242,193,78,0.2)]", // Gold
                    "bg-cream/15 text-cream border-cream/30", // Silver
                    "bg-orange-500/15 text-orange-400 border-orange-500/30", // Bronze
                  ];

                  return (
                    <div
                      key={`${score.date}-${score.score}-${score.height}`}
                      className="group flex flex-col rounded-xl border border-border/40 bg-surface/30 p-3 hover:border-border/80 transition-all duration-200"
                    >
                      {/* Top Row: Rank & Score */}
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          {/* Rank Badge */}
                          <div
                            className={`flex size-7 shrink-0 items-center justify-center rounded-lg border font-display text-xs font-bold tabular-nums ${
                              isPodium
                                ? rankStyles[rank - 1]
                                : "border-border/30 bg-bg/40 text-fg-muted"
                            }`}
                          >
                            #{rank}
                          </div>
                          {/* Run Score */}
                          <div className="flex flex-col">
                            <span className="font-display text-base font-black text-cream tracking-wide group-hover:text-tramp-gold transition-colors tabular-nums">
                              {score.score.toLocaleString()}
                            </span>
                            <span className="font-ui text-[10px] text-fg-subtle leading-none">
                              COMPOSITE SCORE
                            </span>
                          </div>
                        </div>

                        {/* Climb details */}
                        <div className="flex items-center gap-4 text-right">
                          {/* Height */}
                          <div className="flex flex-col items-end">
                            <span className="font-display text-sm font-bold text-accent tabular-nums flex items-center gap-0.5">
                              {score.height}m
                            </span>
                            <span className="font-ui text-[9px] text-fg-subtle leading-none">
                              ALTITUDE
                            </span>
                          </div>
                          {/* Crystals */}
                          <div className="flex flex-col items-end">
                            <span className="font-display text-sm font-bold text-sun tabular-nums">
                              {score.crystals}
                            </span>
                            <span className="font-ui text-[9px] text-fg-subtle leading-none">
                              CRYSTALS
                            </span>
                          </div>
                          {/* Max Combo */}
                          <div className="flex flex-col items-end">
                            <span className="font-display text-sm font-bold text-danger tabular-nums">
                              {score.maxCombo}×
                            </span>
                            <span className="font-ui text-[9px] text-fg-subtle leading-none">
                              COMBO
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Footer Row: Metadata */}
                      <div className="mt-2.5 flex items-center justify-between border-t border-border/10 pt-1.5 font-ui text-[10px] text-fg-subtle">
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="rounded bg-bg/50 px-1 py-0.5 font-mono text-[9px] font-bold uppercase text-fg-subtle">
                            {score.difficulty}
                          </span>
                          <span className="truncate">
                            Seed:{" "}
                            <span className="font-mono text-fg-muted">{score.seedPhrase}</span>
                          </span>
                        </div>
                        <span className="flex shrink-0 items-center gap-1">
                          <CalendarDays className="size-3" />
                          {formatDate(score.date)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Close Button */}
        <Button cta size="lg" onClick={() => onOpenChange(false)} className="mt-3 w-full">
          Done
        </Button>
      </div>
    </Dialog>
  );
}
