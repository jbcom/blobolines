import { Zap } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { getBlobDiagnostics } from "@/state";

/**
 * Premium glassmorphic neon AirNudgeIndicator HUD capsule.
 * Displays "NUDGE READY >>" when the player is airborne and has a redirect nudge charge available.
 * Uses edge-triggered visibility changes in a single rAF loop to avoid per-frame React render overhead.
 */
export function AirNudgeIndicator() {
  const [visible, setVisible] = useState(false);
  const lastVisible = useRef(false);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const diag = getBlobDiagnostics();
      const show = !!(diag.airborne && diag.nudgeAvailable);
      if (lastVisible.current !== show) {
        lastVisible.current = show;
        setVisible(show);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 15, scale: 0.85 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.85 }}
          transition={{ type: "spring", stiffness: 450, damping: 24 }}
          className="pointer-events-none select-none mt-2 flex items-center gap-2 rounded-full border border-accent/30 bg-bg/40 px-3.5 py-1.5 font-display text-xs font-black uppercase tracking-widest text-accent shadow-[var(--glow-blue)] backdrop-blur-md"
        >
          <Zap className="size-3.5 fill-accent stroke-accent animate-pulse" />
          <span className="leading-none">Nudge Ready</span>
          <span className="flex items-center text-accent/80 font-normal leading-none" aria-hidden>
            <motion.span
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 0.8, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
            >
              &gt;
            </motion.span>
            <motion.span
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{
                duration: 0.8,
                delay: 0.25,
                repeat: Number.POSITIVE_INFINITY,
                ease: "easeInOut",
              }}
              className="ml-[1px]"
            >
              &gt;
            </motion.span>
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
