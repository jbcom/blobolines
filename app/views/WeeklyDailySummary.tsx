import { CalendarDays, Flame } from "lucide-react";
import { dailyKey, weeklyDailySummary } from "@/sim/daily";
import { useGameStore } from "@/state";

/**
 * "This week" daily summary — a 7-day mini bar chart of the player's best daily-challenge score each
 * day, with the week's best day flagged. Reads the per-day bests (PlayerProgress.dailyBests) the
 * store records on each daily run; computes the trailing week off the live date at the UI edge (the
 * weeklyDailySummary sim stays pure/date-injected). Renders nothing until at least one daily is in.
 */
export function WeeklyDailySummary() {
  const dailyBests = useGameStore((s) => s.progress.dailyBests) ?? {};
  const streak = useGameStore((s) => s.progress.dailyStreak) ?? 0;
  const summary = weeklyDailySummary(dailyBests, dailyKey(new Date()));

  if (summary.daysPlayed === 0) return null; // nothing to show until the player runs a daily

  return (
    <div
      data-testid="weekly-daily-summary"
      className="flex flex-col gap-2 rounded-xl border border-border/40 bg-bg/30 px-3 py-2.5"
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 font-display text-[11px] font-bold uppercase tracking-wide text-fg-subtle">
          <CalendarDays className="size-3.5" aria-hidden /> This week's dailies
        </span>
        {streak >= 1 && (
          <span className="flex items-center gap-1 font-ui text-[11px] font-semibold tabular-nums text-tramp-orange">
            <Flame className="size-3" aria-hidden /> {streak}-day streak
          </span>
        )}
      </div>

      {/* 7 day columns, oldest → newest. Bar height encodes that day's best vs the week best; the
          week-best day glows gold; unplayed days show a faint empty stub. */}
      <div className="flex items-end justify-between gap-1" style={{ height: 56 }}>
        {summary.days.map((d) => {
          const frac = summary.weekBest > 0 ? d.best / summary.weekBest : 0;
          const barH = d.played ? Math.max(0.12, frac) * 48 : 3;
          // The single-letter UTC weekday for the label (derived from the day key — pure, no locale).
          const dow = ["S", "M", "T", "W", "T", "F", "S"][
            new Date(`${d.key}T00:00:00Z`).getUTCDay()
          ];
          return (
            <div key={d.key} className="flex flex-1 flex-col items-center gap-1">
              {/* role="img" so the data-carrying aria-label is valid on this presentational bar. */}
              <div
                role="img"
                className={`w-full rounded-t ${
                  d.isWeekBest ? "bg-tramp-gold" : d.played ? "bg-tramp-orange/70" : "bg-border/40"
                }`}
                style={{ height: barH }}
                title={d.played ? `${d.key}: ${d.best.toLocaleString()}` : `${d.key}: no run`}
                aria-label={
                  d.played
                    ? `${d.key}: ${d.best.toLocaleString()} points`
                    : `${d.key}: no daily run`
                }
              />
              <span className="font-ui text-[9px] font-semibold text-fg-subtle">{dow}</span>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between font-ui text-[10px] text-fg-subtle tabular-nums">
        <span>
          {summary.daysPlayed}/7 day{summary.daysPlayed === 1 ? "" : "s"} played
        </span>
        <span className="text-cream">
          Best:{" "}
          <span className="font-semibold text-tramp-gold">{summary.weekBest.toLocaleString()}</span>
        </span>
      </div>
    </div>
  );
}
