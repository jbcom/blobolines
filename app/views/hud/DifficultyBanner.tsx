import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { duckMusic, playMilestone } from "@/audio";
import type { WorldDifficulty } from "@/core/types";
import {
  difficultyRank,
  effectiveRouteDifficulty,
  flash,
  routeProfile,
  useGameStore,
  useWorldStore,
} from "@/state";

const BANNER_MS = 1800;

function shoutLabel(difficulty: WorldDifficulty): string {
  return `${routeProfile(difficulty).label.toUpperCase()}!!!`;
}

export function DifficultyBanner() {
  const phase = useGameStore((s) => s.phase);
  const startingDifficulty = useWorldStore((s) => s.difficulty);
  const current = useGameStore((s) => effectiveRouteDifficulty(startingDifficulty, s.run.height));
  const last = useRef<WorldDifficulty>(current);
  const [shown, setShown] = useState<WorldDifficulty | null>(null);

  useEffect(() => {
    if (phase !== "playing") {
      last.current = current;
      setShown(null);
      return;
    }
    const previous = last.current;
    if (difficultyRank(current) > difficultyRank(previous)) {
      setShown(current);
      flash("gold", 0.9);
      // Escalate the stinger with the altitude at the difficulty-up (like the 100m milestone). Read
      // the height at fire time so this effect stays keyed on the DISCRETE difficulty, not the
      // continuous height (which would re-run it every frame).
      playMilestone(useGameStore.getState().run.height);
      duckMusic(800);
    }
    last.current = current;
  }, [current, phase]);

  useEffect(() => {
    if (!shown) return;
    const t = setTimeout(() => setShown(null), BANNER_MS);
    return () => clearTimeout(t);
  }, [shown]);

  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-[34%] flex justify-center"
      aria-live="polite"
    >
      <AnimatePresence>
        {shown && (
          <motion.div
            key={shown}
            initial={{ scale: 0.45, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 1.16, opacity: 0, y: -16 }}
            transition={{ type: "spring", stiffness: 430, damping: 17 }}
            className="flex flex-col items-center text-center"
          >
            <span className="font-display text-5xl font-bold text-cream drop-shadow-[0_3px_14px_rgba(0,0,0,0.45)]">
              {shoutLabel(shown)}
            </span>
            <span className="mt-1 rounded-full border border-tramp-gold/50 bg-bg/65 px-3 py-1 font-ui text-xs font-black uppercase tracking-[0.2em] text-tramp-gold shadow-[var(--shadow-md)]">
              difficulty up
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
