import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState, useSyncExternalStore } from "react";
import {
  getRouteLandingFeedback,
  type RouteLandingFeedback,
  type RouteLandingGrade,
  subscribeRouteLandingFeedback,
} from "@/state";

const TOAST_MS = 1350;

const GRADE_LABEL: Record<RouteLandingGrade, string> = {
  perfect: "Perfect route",
  great: "Great route",
  clean: "Clean route",
  edge: "Edge catch",
};

function useRouteLandingFeedback(): RouteLandingFeedback | null {
  return useSyncExternalStore(
    subscribeRouteLandingFeedback,
    getRouteLandingFeedback,
    getRouteLandingFeedback,
  );
}

export function RouteLandingToast() {
  const feedback = useRouteLandingFeedback();
  const [shown, setShown] = useState<RouteLandingFeedback | null>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (!feedback) {
      setShown(null);
      return;
    }
    setShown(feedback);
    const timer = window.setTimeout(() => setShown(null), TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  return (
    <div
      className="pointer-events-none absolute inset-x-0 flex justify-center"
      style={{ bottom: "calc(var(--safe-bottom) + 8.5rem)" }}
      aria-live="polite"
    >
      <AnimatePresence>
        {shown && (
          <motion.div
            key={shown.id}
            initial={{ opacity: 0, scale: 0.82, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: -8 }}
            transition={{ duration: reduced ? 0.01 : 0.18 }}
            className="flex min-w-44 flex-col items-center rounded-xl border border-tramp-gold/50 bg-surface/90 px-4 py-2 text-center text-cream shadow-[var(--glow-gold)] backdrop-blur-md"
            role="status"
          >
            <span className="font-display text-base font-bold leading-none text-tramp-gold">
              {GRADE_LABEL[shown.grade]}
            </span>
            <span className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-fg-subtle">
              {shown.sourceMode} to {shown.targetType} - +{shown.bonus} style
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
