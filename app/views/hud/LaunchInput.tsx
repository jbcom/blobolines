import { useKeyboardSteer } from "@app/hooks";
import { useDrag } from "@use-gesture/react";
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useSpring } from "motion/react";
import { useRef, useState } from "react";
import { computeAim, computeAirSteer } from "@/input";
import { isPerfectRelease } from "@/sim/launch";
import {
  bounceChargesLeft,
  getBlobDiagnostics,
  requestLaunch,
  requestMidAirBounce,
  setAim,
  setAirSteer,
  useGameStore,
} from "@/state";

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
  const [airReticleActive, setAirReticleActive] = useState(false);
  const airReticleActiveRef = useRef(false);
  const reticleOriginX = useMotionValue(0);
  const reticleOriginY = useMotionValue(0);
  const reticleOffsetX = useMotionValue(-14);
  const reticleOffsetY = useMotionValue(-14);
  const reticleDotX = useSpring(reticleOffsetX, {
    stiffness: 520,
    damping: 34,
  });
  const reticleDotY = useSpring(reticleOffsetY, {
    stiffness: 520,
    damping: 34,
  });
  // Honor prefers-reduced-motion: drop the infinite pulse loops to a single static cue.
  const reduced = useReducedMotion();
  const repeat = reduced ? 0 : Number.POSITIVE_INFINITY;

  const showAirReticle = (originX: number, originY: number, offsetX: number, offsetY: number) => {
    reticleOriginX.set(originX);
    reticleOriginY.set(originY);
    reticleOffsetX.set(offsetX - 14);
    reticleOffsetY.set(offsetY - 14);
    if (!airReticleActiveRef.current) {
      airReticleActiveRef.current = true;
      setAirReticleActive(true);
    }
  };

  const hideAirReticle = () => {
    if (airReticleActiveRef.current) {
      airReticleActiveRef.current = false;
      setAirReticleActive(false);
    }
  };

  const bind = useDrag(({ movement: [mx, my], down, last, tap, initial: [ix, iy] }) => {
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
        hideAirReticle();
        return;
      }
      // Mid-air 3D steering: drag → continuous lateral force; release → stop.
      if (down) {
        const [sx, sz] = computeAirSteer(mx, my);
        setAirSteer(sx, sz);
        const dist = Math.hypot(mx, my);
        const maxOffset = 42;
        const k = dist > maxOffset ? maxOffset / dist : 1;
        showAirReticle(ix, iy, mx * k, my * k);
      } else {
        setAirSteer(0, 0);
        hideAirReticle();
      }
      setCharge(0);
      return;
    }

    hideAirReticle();
    // Slingshot on a pad: charge while dragging, launch on release.
    const aim = computeAim(mx, my, { maxDragDist: 140, sensitivity });
    setCharge(down ? aim.strength : 0);
    // Publish the live aim so the in-scene trajectory preview shows where it'll go.
    setAim(down && aim.strength > 0.05 ? { dir: aim.dir, charge: aim.strength } : null);
    if (last && aim.strength > 0.12) {
      requestLaunch({ dir: aim.dir, charge: aim.strength });
    }
  });

  // "Perfect" = the live charge sits in the perfect-release sweet spot — releasing here earns
  // the power bonus, so the bar + flourish flip to a gold "PERFECT!" cue to invite the timing.
  const perfect = isPerfectRelease(charge);

  return (
    <div
      {...bind()}
      role="application"
      aria-label="Launch area — drag back to aim and release to fling the blob; drag while airborne to steer"
      className="pointer-events-auto absolute inset-0 touch-none"
    >
      {/* Edge glow that ignites as the charge nears max — the screen itself tenses up. */}
      <AnimatePresence>
        {airReticleActive && (
          <motion.div
            key="air-steer-reticle"
            aria-hidden
            data-testid="air-steer-reticle"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.12 }}
            className="pointer-events-none absolute size-24 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-accent/70 bg-bg/15 shadow-[var(--glow-blue)] backdrop-blur-[2px]"
            style={{
              left: reticleOriginX,
              top: reticleOriginY,
            }}
          >
            <span className="absolute top-1/2 left-2 right-2 h-px -translate-y-1/2 bg-accent/35" />
            <span className="absolute top-2 bottom-2 left-1/2 w-px -translate-x-1/2 bg-accent/35" />
            <motion.span
              className="absolute top-1/2 left-1/2 size-7 rounded-full border-2 border-cream/90 bg-accent/70 shadow-[var(--glow-blue)]"
              style={{
                x: reticleDotX,
                y: reticleDotY,
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {perfect && (
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
            {perfect && (
              <motion.span
                aria-hidden
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: reduced ? 1 : [1, 1.15, 1], opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4, repeat }}
                className="font-display text-sm font-bold uppercase tracking-[0.2em] text-tramp-gold"
              >
                PERFECT!
              </motion.span>
            )}
          </AnimatePresence>
          <motion.div
            className="h-2 w-44 overflow-hidden rounded-full border border-border bg-bg/70"
            // Pulse the bar's scale in the perfect window so it visibly snaps to the sweet spot.
            animate={perfect && !reduced ? { scaleY: [1, 1.5, 1] } : { scaleY: 1 }}
            transition={{ duration: 0.4, repeat: perfect ? repeat : 0 }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${charge * 100}%`,
                background: perfect
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
