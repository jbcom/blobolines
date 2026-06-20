import { Trophy } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { playChime } from "@/audio";
import {
  type AchievementToast as AchievementToastData,
  clearAchievementToast,
  getAchievementToast,
  subscribeAchievementToast,
} from "@/state";

const TOAST_DURATION_MS = 2500;

function useAchievementToast(): AchievementToastData | null {
  return useSyncExternalStore(subscribeAchievementToast, getAchievementToast, getAchievementToast);
}

export function AchievementToast() {
  const toastData = useAchievementToast();
  const [shown, setShown] = useState<AchievementToastData | null>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (!toastData) {
      setShown(null);
      return;
    }

    // Play celebratory chime sound on new toast
    playChime();

    setShown(toastData);

    const timer = window.setTimeout(() => {
      setShown(null);
      clearAchievementToast();
    }, TOAST_DURATION_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [toastData]);

  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-16 z-50 flex justify-center px-4"
      aria-live="assertive"
    >
      <AnimatePresence>
        {shown && (
          <motion.div
            key={shown.id}
            initial={{ opacity: 0, y: -40, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 20,
              duration: reduced ? 0.01 : undefined,
            }}
            className="flex items-center gap-3 rounded-2xl border border-tramp-gold/50 bg-surface/90 px-5 py-3 shadow-[0_0_20px_rgba(242,193,78,0.25)] backdrop-blur-md"
            role="status"
          >
            {/* Spinning Trophy Icon */}
            <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-tramp-gold/10 text-tramp-gold shadow-[0_0_10px_rgba(242,193,78,0.2)]">
              <motion.div
                animate={reduced ? {} : { rotate: 360 }}
                transition={{
                  repeat: Infinity,
                  duration: 8,
                  ease: "linear",
                }}
              >
                <Trophy className="h-5 w-5" />
              </motion.div>
            </div>

            {/* Title and Description */}
            <div className="flex flex-col text-left">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-tramp-gold">
                Achievement Unlocked!
              </span>
              <span className="font-display text-base font-bold leading-tight text-cream">
                {shown.title}
              </span>
              <span className="text-xs text-fg-subtle leading-tight">{shown.description}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
