import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { getAim, getBlobDiagnostics, useGameStore } from "@/state";

/**
 * Second first-run coachmark: teaches MID-AIR STEERING, the core skill the launch coachmark
 * (Onboarding) doesn't cover. It appears the first time the blob is airborne after a launch and
 * reads "Drag to steer". It dismisses (persisted) as soon as the player actually steers — a mid-air
 * aim drag — or after a short auto-timeout so it never lingers into the descent.
 *
 * Kept separate from `tutorialSeen` (the launch cue) via its own `steerTutorialSeen` flag so each
 * core skill gets its own one-time teach.
 */
const AUTO_DISMISS_MS = 2600;

export function SteerCoachmark() {
  const phase = useGameStore((s) => s.phase);
  const steerSeen = useGameStore((s) => s.progress.steerTutorialSeen) ?? false;
  const tutorialSeen = useGameStore((s) => s.progress.tutorialSeen);
  const markSteerTutorialSeen = useGameStore((s) => s.markSteerTutorialSeen);
  const [airborneOnce, setAirborneOnce] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const reduced = useReducedMotion();

  // Only relevant once the launch cue is done (the player has launched at least once) and the steer
  // cue hasn't been seen. We arm on the FIRST airborne moment and show until a steer or the timeout.
  const eligible = phase === "playing" && tutorialSeen && !steerSeen && !dismissed;
  const show = eligible && airborneOnce;

  // Arm: flip airborneOnce the first frame the blob is airborne (the moment steering becomes possible).
  useEffect(() => {
    if (!eligible || airborneOnce) return;
    let raf = 0;
    const tick = () => {
      if (getBlobDiagnostics().airborne) {
        setAirborneOnce(true);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [eligible, airborneOnce]);

  // While shown: dismiss + persist the instant the player steers (an aim drag while airborne), and
  // arm an auto-dismiss so the cue never bleeds into the fall. Steering is the real teach signal;
  // the timeout is the safety net.
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!show) return;
    // Single-fire: whichever leg (a steer/land detection or the auto-timeout) reaches finish() first
    // cancels the OTHER, so finish() never runs twice. (markSteerTutorialSeen is idempotent anyway,
    // but keeping it single-fire avoids a redundant setState + keeps the intent obvious.)
    const finish = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      cancelAnimationFrame(raf);
      setDismissed(true);
      markSteerTutorialSeen();
    };
    let raf = 0;
    const tick = () => {
      // A mid-air aim drag is the steer input; landing (no longer airborne) also ends the window.
      if (getAim() != null || !getBlobDiagnostics().airborne) {
        finish();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    timerRef.current = setTimeout(finish, AUTO_DISMISS_MS);
    return () => {
      cancelAnimationFrame(raf);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [show, markSteerTutorialSeen]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="pointer-events-none absolute inset-x-0 top-[34%] flex flex-col items-center gap-3"
          role="status"
        >
          {/* A left-right sweep cue: a dot drifting side to side to read as "drag". Static under
              reduced motion. */}
          {reduced ? (
            <div
              aria-hidden
              className="size-7 rounded-full border-2 border-cream/80 bg-cream/30 shadow-[var(--glow-warm)]"
            />
          ) : (
            <motion.div
              aria-hidden
              className="size-7 rounded-full border-2 border-cream/80 bg-cream/30 shadow-[var(--glow-warm)]"
              animate={{ x: [-22, 22, -22], opacity: [0.7, 1, 0.7] }}
              transition={{ duration: 1.5, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
            />
          )}
          <span className="rounded-full bg-bg/70 px-4 py-1.5 font-display text-sm font-bold text-cream backdrop-blur-md">
            Drag to steer
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
