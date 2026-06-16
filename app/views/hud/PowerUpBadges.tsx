import { Magnet, Rocket } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { POWERUP_DURATION, powerupRemaining } from "@/state";

/**
 * Active power-up badges (magnet + hyper-thrust) with a per-badge countdown bar. The timers
 * live in the imperative powerup bridge (frame cadence); a single rAF loop reads the exact
 * remaining fraction each frame and writes it imperatively to the bars (no per-frame React
 * render), flipping a badge's mounted state only when it actually turns on/off. Replaces the
 * old 120ms poll — exact timing, smooth countdown, cheaper.
 */
const TYPES = [
  {
    key: "magnet",
    label: "Magnet",
    icon: <Magnet className="size-3.5" strokeWidth={2.5} />,
    tint: "text-blob-blue border-blob-blue/50 bg-blob-blue/15",
  },
  {
    key: "thruster",
    label: "Thrust",
    icon: <Rocket className="size-3.5" strokeWidth={2.5} />,
    tint: "text-accent-warm border-accent-warm/50 bg-accent-warm/15",
  },
] as const;

export function PowerUpBadges() {
  const [active, setActive] = useState<Record<string, boolean>>({});
  // Bar fill DOM nodes keyed by type, written imperatively each frame (no React churn).
  const barRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      for (const { key } of TYPES) {
        const remain = powerupRemaining(key);
        const on = remain > 0;
        setActive((prev) => (prev[key] === on ? prev : { ...prev, [key]: on }));
        const bar = barRefs.current[key];
        if (bar) {
          const frac = Math.max(0, Math.min(1, remain / POWERUP_DURATION[key]));
          bar.style.transform = `scaleX(${frac})`;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="mt-2 flex justify-center gap-2" role="status" aria-live="polite">
      <AnimatePresence>
        {TYPES.filter((t) => active[t.key]).map((t) => (
          <Badge
            key={t.key}
            icon={t.icon}
            label={t.label}
            tint={t.tint}
            barRef={(el) => {
              barRefs.current[t.key] = el;
            }}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

function Badge({
  icon,
  label,
  tint,
  barRef,
}: {
  icon: React.ReactNode;
  label: string;
  tint: string;
  barRef: (el: HTMLDivElement | null) => void;
}) {
  return (
    <motion.div
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.6, opacity: 0 }}
      transition={{ type: "spring", stiffness: 480, damping: 22 }}
      className={`flex flex-col items-stretch gap-1 rounded-2xl border px-3 py-1 font-ui text-xs font-bold backdrop-blur-md ${tint}`}
    >
      <span className="flex items-center gap-1.5">
        <span aria-hidden>{icon}</span>
        {label}
      </span>
      {/* Countdown bar — driven imperatively (barRef) via scaleX from the rAF loop. */}
      <div className="h-1 w-full overflow-hidden rounded-full bg-current/20">
        <div
          ref={barRef}
          className="h-full origin-left rounded-full bg-current"
          style={{ transform: "scaleX(1)" }}
        />
      </div>
    </motion.div>
  );
}
