import { useKeyboardSteer } from "@app/hooks";
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useSpring } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { computeAim, computeAirSteer } from "@/input";
import { isPerfectRelease } from "@/sim/launch";
import {
  bounceChargesLeft,
  getBlobDiagnostics,
  getViewControls,
  isBlobScreenTarget,
  requestLaunch,
  requestMidAirBounce,
  rotateView,
  setAim,
  setAirSteer,
  setBlobScreenTarget,
  setViewZoom,
  useGameStore,
  zoomView,
} from "@/state";

type GestureMode = "game" | "view" | "pinch";

interface PointerInfo {
  x: number;
  y: number;
}

/**
 * Full-screen input surface (PLAYING only). Dual-mode:
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
  const pointers = useRef(new Map<number, PointerInfo>());
  const gesture = useRef({
    mode: "view" as GestureMode,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    moved: false,
    pinchDistance: 1,
    pinchZoom: 1,
  });
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

  useEffect(() => {
    setBlobScreenTarget({ x: Number.NaN, y: Number.NaN, radius: 76 });
  }, []);

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

  const activePointer = () => pointers.current.values().next().value as PointerInfo | undefined;

  const pointerDistance = () => {
    const [a, b] = [...pointers.current.values()];
    if (!a || !b) return 1;
    return Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
  };

  const updateGameGesture = (x: number, y: number, down: boolean, last: boolean) => {
    const mx = x - gesture.current.startX;
    const my = y - gesture.current.startY;
    if (Math.hypot(mx, my) > 4) gesture.current.moved = true;
    const tap = !gesture.current.moved;
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
        showAirReticle(gesture.current.startX, gesture.current.startY, mx * k, my * k);
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
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size >= 2) {
      gesture.current.mode = "pinch";
      gesture.current.pinchDistance = pointerDistance();
      gesture.current.pinchZoom = getViewControls().zoom;
      setAim(null);
      setAirSteer(0, 0);
      hideAirReticle();
      return;
    }

    const mode: GestureMode = isBlobScreenTarget(e.clientX, e.clientY) ? "game" : "view";
    gesture.current = {
      mode,
      startX: e.clientX,
      startY: e.clientY,
      lastX: e.clientX,
      lastY: e.clientY,
      moved: false,
      pinchDistance: 1,
      pinchZoom: getViewControls().zoom,
    };
    if (mode === "game") updateGameGesture(e.clientX, e.clientY, true, false);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const pointer = pointers.current.get(e.pointerId);
    if (!pointer) return;
    e.preventDefault();
    pointer.x = e.clientX;
    pointer.y = e.clientY;

    if (gesture.current.mode === "pinch" && pointers.current.size >= 2) {
      setViewZoom((pointerDistance() / gesture.current.pinchDistance) * gesture.current.pinchZoom);
      return;
    }

    if (gesture.current.mode === "view") {
      const dx = e.clientX - gesture.current.lastX;
      const dy = e.clientY - gesture.current.lastY;
      gesture.current.lastX = e.clientX;
      gesture.current.lastY = e.clientY;
      if (Math.hypot(e.clientX - gesture.current.startX, e.clientY - gesture.current.startY) > 4) {
        gesture.current.moved = true;
      }
      rotateView(dx, dy);
      setAim(null);
      setAirSteer(0, 0);
      hideAirReticle();
      return;
    }

    updateGameGesture(e.clientX, e.clientY, true, false);
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const pointer = pointers.current.get(e.pointerId);
    if (!pointer) return;
    e.preventDefault();
    if (gesture.current.mode === "game") {
      updateGameGesture(e.clientX, e.clientY, false, true);
    }
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 1) {
      const remaining = activePointer();
      if (remaining) {
        gesture.current = {
          mode: "view",
          startX: remaining.x,
          startY: remaining.y,
          lastX: remaining.x,
          lastY: remaining.y,
          moved: false,
          pinchDistance: 1,
          pinchZoom: getViewControls().zoom,
        };
      }
    }
  };

  const onPointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId);
    setAim(null);
    setAirSteer(0, 0);
    setCharge(0);
    hideAirReticle();
  };

  const onWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    zoomView(-e.deltaY);
  };

  // "Perfect" = the live charge sits in the perfect-release sweet spot — releasing here earns
  // the power bonus, so the bar + flourish flip to a gold "PERFECT!" cue to invite the timing.
  const perfect = isPerfectRelease(charge);

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onWheel={onWheel}
      role="application"
      aria-label="Launch area — drag back to aim on the blob and release to fling; drag off the blob to rotate the view; pinch or wheel to zoom"
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
