import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { playChime } from "@/audio";
import { biomeBandAt, biomeBandIndex, biomeBandLabel } from "@/config";
import { flash, useGameStore } from "@/state";

/**
 * A gentle "Entering <Biome>" note shown when the climb first crosses UP into a new canonical
 * biome band — the player-facing payoff for the four-dimension biome work (scenery/parallax/audio/
 * particles). It deliberately uses a SOFT cue (a brief blue flash + the collect chime), leaving the
 * loud gold-flash + milestone stinger to `DifficultyBanner`'s difficulty-up moment. Mirrors that
 * banner's structure; watches `run.height` (the climb readout) and only fires on an upward crossing.
 */
const BANNER_MS = 1600;

export function BiomeBanner() {
  const phase = useGameStore((s) => s.phase);
  const height = useGameStore((s) => s.run.height);
  const band = biomeBandAt(height);
  const last = useRef<string>(band);
  const [shown, setShown] = useState<string | null>(null);

  useEffect(() => {
    if (phase !== "playing") {
      last.current = band;
      setShown(null);
      return;
    }
    // Only announce an UPWARD crossing (a higher band index than the one we were in).
    if (biomeBandIndex(band) > biomeBandIndex(last.current)) {
      setShown(band);
      flash("blue", 0.4); // soft — the difficulty banner owns the loud gold flash
      playChime();
    }
    last.current = band;
  }, [band, phase]);

  useEffect(() => {
    if (!shown) return;
    const t = setTimeout(() => setShown(null), BANNER_MS);
    return () => clearTimeout(t);
  }, [shown]);

  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-[24%] flex justify-center"
      aria-live="polite"
    >
      <AnimatePresence>
        {shown && (
          <motion.div
            key={shown}
            initial={{ scale: 0.8, opacity: 0, y: 14 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 1.05, opacity: 0, y: -12 }}
            transition={{ type: "spring", stiffness: 360, damping: 22 }}
            className="flex flex-col items-center text-center"
            data-testid="biome-banner"
          >
            <span className="font-ui text-[11px] font-black uppercase tracking-[0.3em] text-cream/70">
              Entering
            </span>
            <span className="font-display text-3xl font-bold text-cream drop-shadow-[0_2px_10px_rgba(0,0,0,0.4)]">
              {biomeBandLabel(shown)}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
