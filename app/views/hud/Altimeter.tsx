import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { flash, useGameStore } from "@/state";

/**
 * Vertical altimeter — the core-goal readout: how high the blob has climbed, with a
 * per-100m progress bar. The whole game is "go as high as possible", so this is the
 * most prominent HUD element. When the current run first passes the lifetime best, the
 * Best line pulses gold and a "NEW BEST!" flourish fires once — the climb's marquee moment.
 */
export function Altimeter() {
  const height = useGameStore((s) => Math.max(0, Math.floor(s.run.height)));
  const best = useGameStore((s) => s.progress.bestHeight);
  const phase = useGameStore((s) => s.phase);
  const milestoneProgress = ((height % 100) / 100) * 100;

  // In-run personal-best flourish: fire once when height first exceeds the best the run
  // started from (snapshot at run start so commitBestHeight raising the stored best
  // mid-climb doesn't re-trigger it).
  const runStartBest = useRef(best);
  const [beatBest, setBeatBest] = useState(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: snapshot best only at run start
  useEffect(() => {
    if (phase === "playing") {
      runStartBest.current = best;
      setBeatBest(false);
    }
  }, [phase]);
  useEffect(() => {
    if (
      phase === "playing" &&
      !beatBest &&
      runStartBest.current > 0 &&
      height > runStartBest.current
    ) {
      setBeatBest(true);
      flash("gold", 0.8);
    }
  }, [height, phase, beatBest]);

  return (
    // Labelled group, NOT a live region: height changes ~every frame, so aria-live here
    // would machine-gun a screen reader. The aria-label lets a user poll the value; the
    // animated inner spans are aria-hidden so the per-frame churn isn't re-announced.
    <div
      role="img"
      className="pointer-events-auto flex flex-col gap-1 rounded-xl border border-border bg-surface px-4 py-3 backdrop-blur-md"
      aria-label={`Altitude ${height} meters, best ${best} meters`}
    >
      <span
        aria-hidden
        className="text-[10px] font-bold uppercase tracking-[0.18em] text-fg-subtle"
      >
        Altitude
      </span>
      <div className="flex items-baseline gap-1" aria-hidden>
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
      <div className="mt-1 h-1.5 w-32 overflow-hidden rounded-full bg-bg/70" aria-hidden>
        <motion.div
          className="h-full rounded-full bg-accent"
          animate={{ width: `${milestoneProgress}%` }}
          transition={{ ease: "easeOut", duration: 0.3 }}
        />
      </div>
      <div className="mt-0.5 flex items-center gap-1.5" aria-hidden>
        <motion.span
          className="text-[10px] font-semibold text-fg-subtle"
          // Pulse the whole Best line gold the instant the run overtakes the old best.
          animate={beatBest ? { scale: [1, 1.18, 1] } : { scale: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          Best <span className="text-tramp-gold">{best}m</span>
        </motion.span>
        <AnimatePresence>
          {beatBest && (
            <motion.span
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 18 }}
              className="rounded-full bg-tramp-gold/20 px-1.5 text-[9px] font-bold uppercase tracking-wide text-tramp-gold"
            >
              New best!
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
