import { useKeyboardSteer } from "@app/hooks";
import { useDrag } from "@use-gesture/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { computeAim, computeAirSteer } from "@/input";
import {
  bounceChargesLeft,
  getBlobDiagnostics,
  requestLaunch,
  requestMidAirBounce,
  setAim,
  setAirSteer,
  useGameStore,
} from "@/state";

/** Charge fraction at/above which the slingshot reads as "maxed" (full-power flourish). */
const MAX_CHARGE = 0.85;

/**
 * Full-screen input surface (PLAYING only). Dual-mode, matching the PoC:
 *  - blob resting on a pad → drag back to aim + charge the slingshot, release to launch.
 *  - blob airborne → drag to steer mid-air (X/Z), released → steering stops.
 * Pointer-events on so it captures drags above the canvas; the canvas renders beneath.
 */
export function LaunchInput() {
  const sensitivity = useGameStore((s) => s.settings.slingshotSensitivity);
  // Desktop keyboard air-steering (WASD/arrows) — the secondary control alongside the primary
  // touch/mouse drag below. Mounted here so all input lives in one PLAYING-scoped place.
  useKeyboardSteer();
  const [charge, setCharge] = useState(0);
  // Honor prefers-reduced-motion: drop the infinite pulse loops to a single static cue.
  const reduced = useReducedMotion();
  const repeat = reduced ? 0 : Number.POSITIVE_INFINITY;

  const bind = useDrag(({ movement: [mx, my], down, last, tap }) => {
    const airborne = getBlobDiagnostics().airborne;

    if (airborne) {
      // A TAP while airborne (quick press, no drag) spends a multi-bounce charge for a free
      // mid-air bounce — a recovery "double-jump". Only fires when a charge is held; otherwise
      // the tap is inert (no accidental no-op steering jolt). Guarded so a real drag (steering)
      // is never misread as a bounce.
      if (tap && last && bounceChargesLeft() > 0) {
        requestMidAirBounce();
        setAirSteer(0, 0);
        setCharge(0);
        return;
      }
      // Mid-air 3D steering: drag → continuous lateral force; release → stop.
      if (down) {
        const [sx, sz] = computeAirSteer(mx, my);
        setAirSteer(sx, sz);
      } else {
        setAirSteer(0, 0);
      }
      setCharge(0);
      return;
    }

    // Slingshot on a pad: charge while dragging, launch on release.
    const aim = computeAim(mx, my, { maxDragDist: 140, sensitivity });
    setCharge(down ? aim.strength : 0);
    // Publish the live aim so the in-scene trajectory preview shows where it'll go.
    setAim(down && aim.strength > 0.05 ? { dir: aim.dir, charge: aim.strength } : null);
    if (last && aim.strength > 0.12) {
      requestLaunch({ dir: aim.dir, charge: aim.strength });
    }
  });

  const maxed = charge >= MAX_CHARGE;

  return (
    <div
      {...bind()}
      role="application"
      aria-label="Launch area — drag back to aim and release to fling the blob; drag while airborne to steer"
      className="pointer-events-auto absolute inset-0 touch-none"
    >
      {/* Edge glow that ignites as the charge nears max — the screen itself tenses up. */}
      <AnimatePresence>
        {maxed && (
          <motion.div
            aria-hidden
            initial={{ opacity: 0 }}
            animate={{ opacity: reduced ? 0.7 : [0.5, 0.85, 0.5] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.7, repeat, ease: "easeInOut" }}
            className="absolute inset-0"
            style={{
              boxShadow: "inset 0 0 90px 18px var(--color-tramp-gold)",
            }}
          />
        )}
      </AnimatePresence>
      {charge > 0 && (
        <div
          className="absolute bottom-[18%] left-1/2 flex -translate-x-1/2 flex-col items-center gap-1"
          role="progressbar"
          aria-label="Launch power"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(charge * 100)}
        >
          <AnimatePresence>
            {maxed && (
              <motion.span
                aria-hidden
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: reduced ? 1 : [1, 1.15, 1], opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4, repeat }}
                className="font-display text-sm font-bold uppercase tracking-[0.2em] text-tramp-gold"
              >
                Max!
              </motion.span>
            )}
          </AnimatePresence>
          <motion.div
            className="h-2 w-44 overflow-hidden rounded-full border border-border bg-bg/70"
            // Pulse the bar's scale when maxed so it visibly strains at full power.
            animate={maxed && !reduced ? { scaleY: [1, 1.5, 1] } : { scaleY: 1 }}
            transition={{ duration: 0.4, repeat: maxed ? repeat : 0 }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${charge * 100}%`,
                background: maxed
                  ? "var(--color-tramp-gold)"
                  : "linear-gradient(to right, var(--color-accent), var(--color-accent-warm))",
              }}
            />
          </motion.div>
        </div>
      )}
    </div>
  );
}
