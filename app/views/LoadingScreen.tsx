import { motion } from "motion/react";

/**
 * Loading screen — shown while the app boots (Suspense fallback for the first Canvas /
 * font load). A bouncing gooey blob over the wordmark, in the brand identity.
 */
export function LoadingScreen() {
  return (
    <div className="absolute inset-0 z-[var(--z-loader)] flex flex-col items-center justify-center gap-6 bg-bg">
      <motion.div
        className="size-16 rounded-full bg-accent shadow-[var(--glow-blue)]"
        animate={{ y: [0, -18, 0], scaleX: [1, 1.15, 1], scaleY: [1, 0.85, 1] }}
        transition={{ duration: 0.7, repeat: Number.POSITIVE_INFINITY, ease: [0.5, 0, 0.1, 1.4] }}
      />
      <span className="font-display text-2xl font-bold text-cream/80">Blobolines</span>
    </div>
  );
}
