import { Hourglass, Magnet, Repeat2, Rocket, Star } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { MULTI_BOUNCE_CHARGES, POWERUP_DURATION, powerupRemaining } from "@/state";

/**
 * Active power-up badges with a per-badge progress bar. The timers/charges live in the
 * imperative powerup bridge (frame cadence); a single rAF loop reads the exact remaining
 * fraction each frame and writes it imperatively to the bars (no per-frame React render),
 * flipping a badge's mounted state only when it actually turns on/off. Replaces the old 120ms
 * poll — exact timing, smooth countdown, cheaper.
 *
 * `denom` is what the remaining value is divided by for the bar fraction: a buff's duration
 * for the timed ones, the full charge stack for multi-bounce (so its bar shows charges left).
 */
const TYPES = [
  {
    key: "magnet",
    label: "Magnet",
    icon: <Magnet className="size-3.5" strokeWidth={2.5} />,
    tint: "text-blob-blue border-blob-blue/50 bg-blob-blue/15",
    denom: POWERUP_DURATION.magnet,
  },
  {
    key: "thruster",
    label: "Thrust",
    icon: <Rocket className="size-3.5" strokeWidth={2.5} />,
    tint: "text-accent-warm border-accent-warm/50 bg-accent-warm/15",
    denom: POWERUP_DURATION.thruster,
  },
  {
    key: "slowmo",
    label: "Slow-Mo",
    icon: <Hourglass className="size-3.5" strokeWidth={2.5} />,
    tint: "text-tramp-violet border-tramp-violet/50 bg-tramp-violet/15",
    denom: POWERUP_DURATION.slowmo,
  },
  {
    key: "doubler",
    label: "2× Score",
    icon: <Star className="size-3.5" strokeWidth={2.5} />,
    tint: "text-tramp-gold border-tramp-gold/50 bg-tramp-gold/15",
    denom: POWERUP_DURATION.doubler,
  },
  {
    key: "multibounce",
    label: "Bounce",
    icon: <Repeat2 className="size-3.5" strokeWidth={2.5} />,
    tint: "text-tramp-green border-tramp-green/50 bg-tramp-green/15",
    denom: MULTI_BOUNCE_CHARGES,
  },
] as const;

export function PowerUpBadges() {
  const [active, setActive] = useState<Record<string, boolean>>({});
  // Bar fill DOM nodes keyed by type, written imperatively each frame (no React churn).
  const barRefs = useRef<Record<string, HTMLDivElement | null>>({});
  // Last known on/off per type, so we only call setActive on an actual edge — not 60×/s.
  const lastOn = useRef<Record<string, boolean>>({});

  // Charge COUNT per badge (only meaningful for stack-based buffs like multi-bounce). Written
  // imperatively each frame; flips React state only when the integer count actually changes.
  const countRefs = useRef<Record<string, HTMLSpanElement | null>>({});
  const lastCount = useRef<Record<string, number>>({});

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      for (const { key, denom } of TYPES) {
        const remain = powerupRemaining(key);
        const on = remain > 0;
        // Flip React state only when the active edge actually changes (mount/unmount the
        // badge); the bar itself updates imperatively every frame below.
        if (lastOn.current[key] !== on) {
          lastOn.current[key] = on;
          setActive((prev) => ({ ...prev, [key]: on }));
        }
        const bar = barRefs.current[key];
        if (bar) {
          const frac = Math.max(0, Math.min(1, remain / denom));
          bar.style.transform = `scaleX(${frac})`;
        }
        // Stack badges (multi-bounce) show a live "×N" charge count; timed buffs leave it blank.
        const countEl = countRefs.current[key];
        if (countEl) {
          const n = Math.ceil(remain);
          if (lastCount.current[key] !== n) {
            lastCount.current[key] = n;
            countEl.textContent = `×${n}`;
          }
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
            // Multi-bounce is a charge stack — show a live "×N" count; timed buffs don't.
            showCount={t.key === "multibounce"}
            barRef={(el) => {
              barRefs.current[t.key] = el;
            }}
            countRef={(el) => {
              countRefs.current[t.key] = el;
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
  countRef,
  showCount,
}: {
  icon: React.ReactNode;
  label: string;
  tint: string;
  barRef: (el: HTMLDivElement | null) => void;
  countRef: (el: HTMLSpanElement | null) => void;
  showCount: boolean;
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
        {/* Live charge count for stack buffs (multi-bounce) — written imperatively each frame. */}
        {showCount && <span ref={countRef} className="tabular-nums" />}
      </span>
      {/* Progress bar — driven imperatively (barRef) via scaleX from the rAF loop. */}
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
