import { usePunchOnChange } from "@app/hooks";
import { Flame } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useGameStore } from "@/state";

/**
 * Clean-bounce combo multiplier. Appears with a springy pop once the streak is ≥2 and
 * scales/glows with the multiplier — reward feedback for chaining trampolines.
 */
export function ComboBadge() {
  const combo = useGameStore((s) => s.run.combo);
  const show = combo >= 2;
  const multiplier = (1 + (combo - 1) * 0.5).toFixed(1);
  // anime.js punch: kick the badge with a scale + alternating tilt on every new clean
  // bounce, so a building streak feels percussive (Motion owns the appear/exit).
  const punchRef = usePunchOnChange<HTMLDivElement>(combo, { scale: 1.4, rotate: 6 });

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ scale: 0.6, opacity: 0, y: -8 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.6, opacity: 0 }}
          transition={{ type: "spring", stiffness: 480, damping: 20 }}
          className="pointer-events-none flex flex-col items-center"
        >
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-tramp-gold">
            Clean combo
          </span>
          <div
            ref={punchRef}
            className="mt-1 flex items-center gap-1.5 rounded-full border border-tramp-gold/50 bg-tramp-gold/15 px-3.5 py-1 backdrop-blur-md"
          >
            <Flame className="size-4 text-tramp-gold" strokeWidth={2.5} />
            <span className="font-display text-lg font-bold leading-none text-tramp-gold">
              {multiplier}×
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
