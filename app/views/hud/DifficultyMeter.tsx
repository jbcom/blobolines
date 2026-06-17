import { routeDifficultyProgress, routeProfile, useGameStore, useWorldStore } from "@/state";

function meters(value: number): string {
  return `${Math.max(0, Math.ceil(value))}m`;
}

export function DifficultyMeter() {
  const height = useGameStore((s) => Math.max(0, s.run.height));
  const startingDifficulty = useWorldStore((s) => s.difficulty);
  const progress = routeDifficultyProgress(startingDifficulty, height);
  const current = routeProfile(progress.current);
  const next = progress.next ? routeProfile(progress.next) : null;
  const progressPct = progress.progress * 100;
  const caption = next ? `${meters(progress.metersToNext)} to ${next.label}` : "Final cadence";

  return (
    <div
      role="img"
      className="pointer-events-auto mt-2 w-36 rounded-xl border border-border bg-[var(--surface-glass)] px-3 py-2 font-ui shadow-[var(--shadow-md)] backdrop-blur-md"
      aria-label={
        next
          ? `Current difficulty ${current.label}, ${meters(progress.metersToNext)} to ${next.label}`
          : `Current difficulty ${current.label}, final cadence`
      }
    >
      <div className="flex items-baseline justify-between gap-2" aria-hidden>
        <span className="text-[9px] font-black uppercase tracking-[0.16em] text-fg-subtle">
          Tier
        </span>
        <span className="max-w-24 truncate text-right font-display text-sm font-black leading-none text-cream">
          {current.label}
        </span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-bg/70" aria-hidden>
        <div
          className="h-full rounded-full bg-tramp-gold transition-[width] duration-[var(--dur-base)] ease-[var(--ease-out-soft)]"
          style={{ width: `${progressPct}%` }}
        />
      </div>
      <div
        className="mt-1 truncate text-[10px] font-bold uppercase tracking-[0.1em] text-fg-muted"
        aria-hidden
      >
        {caption}
      </div>
    </div>
  );
}
