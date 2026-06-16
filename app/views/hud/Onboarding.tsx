import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { getAim, useGameStore } from "@/state";

/**
 * First-run coachmark over the launch surface: a looping drag-ghost (finger pulling back)
 * with "Drag back & release to fling". Shows only until the player's first real launch, then
 * marks the tutorial seen (persisted) so it never shows again. Polls the aim bridge to
 * detect the first drag — once they start aiming, the hint has done its job and fades.
 */
export function Onboarding() {
  const phase = useGameStore((s) => s.phase);
  const tutorialSeen = useGameStore((s) => s.progress.tutorialSeen);
  const markTutorialSeen = useGameStore((s) => s.markTutorialSeen);
  const [dismissed, setDismissed] = useState(false);

  const show = phase === "playing" && !tutorialSeen && !dismissed;

  // Dismiss + persist on the first drag (aim becomes non-null). Poll at human cadence.
  useEffect(() => {
    if (!show) return;
    const id = setInterval(() => {
      if (getAim()) {
        setDismissed(true);
        markTutorialSeen();
      }
    }, 150);
    return () => clearInterval(id);
  }, [show, markTutorialSeen]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="pointer-events-none absolute inset-x-0 bottom-[26%] flex flex-col items-center gap-3"
          role="status"
        >
          {/* Drag-ghost: a dot that pulls down-and-back on a loop, miming the slingshot. */}
          <motion.div
            aria-hidden
            className="size-6 rounded-full border-2 border-cream/80 bg-cream/30"
            animate={{ y: [0, 34, 0], scale: [1, 0.9, 1] }}
            transition={{ duration: 1.4, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
          />
          <span className="rounded-full bg-bg/70 px-4 py-1.5 font-display text-sm font-bold text-cream backdrop-blur-md">
            Drag back &amp; release to fling
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
