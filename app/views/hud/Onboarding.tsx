import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { getAim, getBlobDiagnostics, useGameStore } from "@/state";

/**
 * First-run coachmark over the launch surface: a pulsing hold cue with
 * "Hold & release to fling". Shows only until the player's first real launch, then
 * marks the tutorial seen (persisted) so it never shows again.
 */
export function Onboarding() {
  const phase = useGameStore((s) => s.phase);
  const tutorialSeen = useGameStore((s) => s.progress.tutorialSeen);
  const markTutorialSeen = useGameStore((s) => s.markTutorialSeen);
  const [dismissed, setDismissed] = useState(false);
  const reduced = useReducedMotion();

  const show = phase === "playing" && !tutorialSeen && !dismissed;

  // Dismiss + persist once the player aims OR the blob leaves the ground. Checked per rAF
  // frame (not a 150ms poll) so a quick flick — a drag+release under one poll interval that
  // never leaves `aim` set long enough to sample — still dismisses via the airborne edge.
  useEffect(() => {
    if (!show) return;
    let raf = 0;
    const startY = getBlobDiagnostics().position[1];
    const tick = () => {
      const diag = getBlobDiagnostics();
      const launched = getAim() != null || diag.airborne || diag.position[1] > startY + 0.5;
      if (launched) {
        setDismissed(true);
        markTutorialSeen();
        return; // stop the loop
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
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
          {/* Hold cue: a dot swelling in place. Reduced-motion keeps it static. */}
          {reduced ? (
            <div
              aria-hidden
              className="size-7 rounded-full border-2 border-cream/80 bg-cream/30 shadow-[var(--glow-warm)]"
            />
          ) : (
            <motion.div
              aria-hidden
              className="size-7 rounded-full border-2 border-cream/80 bg-cream/30 shadow-[var(--glow-warm)]"
              animate={{ scale: [1, 1.35, 1], opacity: [0.65, 1, 0.65] }}
              transition={{ duration: 1.4, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
            />
          )}
          <span className="rounded-full bg-bg/70 px-4 py-1.5 font-display text-sm font-bold text-cream backdrop-blur-md">
            Hold &amp; release to fling
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
