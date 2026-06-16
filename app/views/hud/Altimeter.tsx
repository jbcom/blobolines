import { motion } from "motion/react";
import { useGameStore } from "@/state";

/**
 * Vertical altimeter — the core-goal readout: how high the blob has climbed, with a
 * per-100m progress bar. The whole game is "go as high as possible", so this is the
 * most prominent HUD element.
 */
export function Altimeter() {
  const height = useGameStore((s) => Math.max(0, Math.floor(s.run.height)));
  const best = useGameStore((s) => s.progress.bestHeight);
  const milestoneProgress = ((height % 100) / 100) * 100;

  return (
    <div className="pointer-events-auto flex flex-col gap-1 rounded-xl border border-border bg-surface px-4 py-3 backdrop-blur-md">
      <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-fg-subtle">
        Altitude
      </span>
      <div className="flex items-baseline gap-1">
        <motion.span
          key={height}
          data-testid="altitude-value"
          initial={{ y: -6, opacity: 0.4 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
          className="font-display text-3xl font-bold leading-none text-cream"
        >
          {height}
        </motion.span>
        <span className="text-xs font-semibold text-accent">m</span>
      </div>
      <div className="mt-1 h-1.5 w-32 overflow-hidden rounded-full bg-bg/70">
        <motion.div
          className="h-full rounded-full bg-accent"
          animate={{ width: `${milestoneProgress}%` }}
          transition={{ ease: "easeOut", duration: 0.3 }}
        />
      </div>
      <span className="mt-0.5 text-[10px] font-semibold text-fg-subtle">
        Best <span className="text-tramp-gold">{best}m</span>
      </span>
    </div>
  );
}
