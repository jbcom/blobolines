import { motion } from "motion/react";
import { useEffect, useState } from "react";

/**
 * Loading screen — Suspense fallback while the app boots (first Canvas, fonts, Rapier WASM).
 * A bouncing gooey blob over the wordmark, with an HONEST determinate-ish bar: it advances to
 * a real checkpoint when `document.fonts.ready` resolves, then eases asymptotically toward
 * (but never reaches) 100%. It only hits 100% by UNMOUNTING — Suspense resolving is the one
 * truthful "done" signal — so the bar never claims a completion the app hasn't reached.
 */
export function LoadingScreen() {
  const [pct, setPct] = useState(8);

  useEffect(() => {
    let raf = 0;
    let mounted = true;
    let target = 35; // before any real checkpoint, creep toward a modest ceiling
    if (typeof document !== "undefined" && "fonts" in document) {
      document.fonts.ready.then(() => {
        if (mounted) target = 80; // fonts done; remaining unknown is WASM/Canvas (no hook)
      });
    } else {
      target = 80;
    }
    const tick = () => {
      setPct((p) => p + (target - p) * 0.04); // ease toward target, asymptotic (never 100)
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      mounted = false;
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="absolute inset-0 z-[var(--z-loader)] flex flex-col items-center justify-center gap-6 bg-bg">
      <motion.div
        className="size-16 rounded-full bg-accent shadow-[var(--glow-blue)]"
        animate={{ y: [0, -18, 0], scaleX: [1, 1.15, 1], scaleY: [1, 0.85, 1] }}
        transition={{ duration: 0.7, repeat: Number.POSITIVE_INFINITY, ease: [0.5, 0, 0.1, 1.4] }}
      />
      <span className="font-display text-2xl font-bold text-cream/80">Blobolines</span>
      <div
        className="h-1.5 w-40 overflow-hidden rounded-full bg-surface"
        role="progressbar"
        aria-label="Loading"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
      >
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-150 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
