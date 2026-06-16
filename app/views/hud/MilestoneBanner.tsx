import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { playMilestone } from "@/audio";
import { useGameStore } from "@/state";

/** Altitude band size that triggers a celebration (every this-many metres). */
const MILESTONE_STEP = 100;
/** How long the banner stays up before fading out (ms). */
const BANNER_MS = 1600;

/**
 * Transient "100m / 200m …" celebration banner. Each time the blob crosses a new 100m
 * milestone it pops a big number with a chime, then fades — a hit of juice that rewards
 * the climb (the whole game's goal). Detection is edge-triggered off the floored milestone
 * index so it fires exactly once per crossing, never per frame.
 */
export function MilestoneBanner() {
  // Select the FLOORED milestone index, not raw height — the component then re-renders only
  // when a 100m band is crossed (rarely), not on every per-frame height change.
  const milestone = useGameStore((s) => Math.floor(Math.max(0, s.run.height) / MILESTONE_STEP));
  const phase = useGameStore((s) => s.phase);
  const lastMilestone = useRef(0);
  const [shown, setShown] = useState<number | null>(null);

  // Reset the baseline at the start of each run so a fresh run re-celebrates 100m.
  useEffect(() => {
    if (phase === "playing") lastMilestone.current = 0;
  }, [phase]);

  useEffect(() => {
    if (phase !== "playing") return;
    if (milestone > lastMilestone.current) {
      lastMilestone.current = milestone;
      if (milestone > 0) {
        setShown(milestone * MILESTONE_STEP);
        playMilestone();
      }
    }
  }, [milestone, phase]);

  // Auto-dismiss the banner after BANNER_MS.
  useEffect(() => {
    if (shown === null) return;
    const t = setTimeout(() => setShown(null), BANNER_MS);
    return () => clearTimeout(t);
  }, [shown]);

  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-[22%] flex justify-center"
      // Announce the milestone once to AT users; the per-frame altitude stays silent.
      aria-live="polite"
    >
      <AnimatePresence>
        {shown !== null && (
          <motion.div
            key={shown}
            initial={{ scale: 0.3, opacity: 0, y: 16 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 1.15, opacity: 0, y: -12 }}
            transition={{ type: "spring", stiffness: 420, damping: 18 }}
            className="flex flex-col items-center"
          >
            <span className="font-display text-6xl font-bold text-cream drop-shadow-[0_2px_12px_rgba(0,0,0,0.35)]">
              {shown}
              <span className="ml-1 text-3xl text-accent">m</span>
            </span>
            <span className="mt-1 text-sm font-bold uppercase tracking-[0.2em] text-tramp-gold">
              New height!
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
