import { motion, useReducedMotion } from "motion/react";
import { TitleScreen } from "./TitleScreen";

/**
 * The LANDING PAGE — its own page, NOT a phase welded to the game canvas.
 *
 * The menu used to render inside HudOverlay on top of the always-mounted game `<Canvas>`, so
 * the in-game daylight sky painted over this page's DESIGNED purple background
 * (`--bg` "deep berry-plum") — it flashed purple then vanished the instant WebGL's first frame
 * landed. The fix is structural: the landing page is split out at the top of Game.tsx, mounts NO
 * WebGL/game world, and owns its purple backdrop. The game canvas only mounts once a run starts.
 *
 * The hero treatment is pure DOM (a soft goo-blob silhouette on the plum field) so the menu costs
 * nothing on a low-end phone — the heavy renderer is reserved for actual play.
 */
export function LandingPage() {
  const reduced = useReducedMotion();
  return (
    <div className="absolute inset-0 overflow-hidden bg-bg">
      {/* Designed purple field + a soft daylight bloom up top, so the page reads as its own
          place — a calm plum lobby, distinct from the bright-sky game. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: "radial-gradient(120% 80% at 50% -10%, var(--bg-elevated) 0%, var(--bg) 55%)",
        }}
      />
      {/* Pure-DOM hero blob — a gooey plum silhouette that breathes, reading above the
          bottom-anchored TitleScreen menu. No second WebGL context (keeps the menu cheap). */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[28%] -translate-x-1/2 -translate-y-1/2"
        initial={{ scale: 0.92, y: 6 }}
        animate={reduced ? { scale: 1, y: 0 } : { scale: [0.96, 1.03, 0.96], y: [4, -4, 4] }}
        transition={
          reduced
            ? { duration: 0.4 }
            : { duration: 4.2, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }
        }
      >
        <div
          className="size-40 rounded-full shadow-[var(--glow-blue)]"
          style={{
            background:
              "radial-gradient(60% 60% at 38% 32%, var(--blob-blue) 0%, var(--tramp-violet) 70%, var(--blob-nebula) 100%)",
          }}
        />
      </motion.div>

      <TitleScreen />
    </div>
  );
}
