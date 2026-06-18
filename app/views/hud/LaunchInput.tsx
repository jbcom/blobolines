import { useKeyboardSteer } from "@app/hooks";
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useSpring } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { computeAirSteer, computeGroundedRouteCharge, computeRouteAim } from "@/input";
import { isPerfectRelease } from "@/sim/launch";
import type { LaunchRequest } from "@/state";
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
  useWorldStore,
  zoomView,
} from "@/state";
import { nextRouteStep } from "@/world";

type GestureMode = "game" | "view" | "pinch";
const FULL_CHARGE_SECONDS = 1.15;
const TAP_CHARGE = 0.22;
const AUTO_DISCHARGE_SECONDS = 0.95;
const DRAG_DISCHARGE_PX = 165;
const CANCEL_DRAG_PX = 118;

interface PointerInfo {
  x: number;
  y: number;
}

interface GestureState {
  mode: GestureMode;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  startTime: number;
  moved: boolean;
  pinchDistance: number;
  pinchZoom: number;
  groundedChargePeak: number;
  groundedCancelled: boolean;
}

/**
 * Full-screen input surface (PLAYING only). Dual-mode:
 *  - blob resting on a pad → hold on Blobby to charge the certified next-hop thrust, release
 *    to launch. Dragging is no longer required for the core Easy route.
 *  - blob airborne → drag to steer mid-air (X/Z), released → steering stops.
 * Pointer-events on so it captures drags above the canvas; the canvas renders beneath.
 */
export function LaunchInput() {
  const sensitivity = useGameStore((s) => s.settings.chargeSensitivity);
  // Desktop keyboard air-steering (WASD/arrows) — the secondary control alongside the primary
  // touch/mouse drag below. Mounted here so all input lives in one PLAYING-scoped place.
  useKeyboardSteer();
  const [charge, setCharge] = useState(0);
  const [airReticleActive, setAirReticleActive] = useState(false);
  const airReticleActiveRef = useRef(false);
  const pointers = useRef(new Map<number, PointerInfo>());
  const gesture = useRef<GestureState>({
    mode: "view",
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    startTime: 0,
    moved: false,
    pinchDistance: 1,
    pinchZoom: 1,
    groundedChargePeak: 0,
    groundedCancelled: false,
  });
  const chargingRef = useRef(false);
  const [charging, setCharging] = useState(false);
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

  const routeLaunchDirection = useCallback((charge: number): LaunchRequest["dir"] => {
    const diag = getBlobDiagnostics();
    const world = useWorldStore.getState();
    const step = nextRouteStep(diag.groundY, world.trampolines);
    if (step?.target) {
      const source = step.source?.position ?? diag.position;
      if (!step.proof || step.proof.sourceMode === "flat") {
        return computeRouteAim(
          step.target.position[0] - source[0],
          step.target.position[2] - source[2],
          charge,
        );
      }
    }
    const proofNormal = step?.proof?.launchNormal;
    if (proofNormal) {
      const len = Math.hypot(proofNormal[0], proofNormal[1], proofNormal[2]) || 1;
      return [proofNormal[0] / len, proofNormal[1] / len, proofNormal[2] / len];
    }
    if (step?.target) {
      const dx = step.target.position[0] - diag.position[0];
      const dz = step.target.position[2] - diag.position[2];
      const h = Math.hypot(dx, dz);
      if (h > 0.05) {
        const lateral = Math.min(0.82, h / 9);
        const y = 1.22;
        const len = Math.hypot(lateral, y) || 1;
        return [(dx / h) * (lateral / len), y / len, (dz / h) * (lateral / len)];
      }
    }
    return [0, 1, 0];
  }, []);

  const currentRouteCharge = useCallback(
    (timeStamp: number, releasing = false, y = gesture.current.lastY, tapEligible = false) => {
      const held = Math.max(0, (timeStamp - gesture.current.startTime) / 1000);
      const result = computeGroundedRouteCharge(
        {
          heldSeconds: held,
          dragY: y - gesture.current.startY,
          releasing,
          tapEligible,
          wasCharged: gesture.current.groundedChargePeak > 0.02,
        },
        {
          fullChargeSeconds: FULL_CHARGE_SECONDS,
          tapCharge: TAP_CHARGE,
          sensitivity,
          autoDischargeSeconds: AUTO_DISCHARGE_SECONDS,
          dragDischargePx: DRAG_DISCHARGE_PX,
          cancelDragPx: CANCEL_DRAG_PX,
        },
      );
      gesture.current.groundedChargePeak = Math.max(
        gesture.current.groundedChargePeak,
        result.charge,
      );
      if (result.cancelled) gesture.current.groundedCancelled = true;
      return result;
    },
    [sensitivity],
  );

  const publishRouteCharge = useCallback(
    (
      timeStamp: number,
      releasing = false,
      y = gesture.current.lastY,
      tapEligible = false,
    ): LaunchRequest | null => {
      const result = currentRouteCharge(timeStamp, releasing, y, tapEligible);
      if (result.cancelled) {
        setCharge(0);
        setAim(null);
        return null;
      }
      const req = { dir: routeLaunchDirection(result.charge), charge: result.charge };
      setCharge(req.charge);
      setAim(req.charge > 0.02 ? req : null);
      return req;
    },
    [currentRouteCharge, routeLaunchDirection],
  );

  useEffect(() => {
    if (!charging) return;
    let raf = 0;
    const tick = (now: number) => {
      if (!chargingRef.current) return;
      publishRouteCharge(now);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [charging, publishRouteCharge]);

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

  const updateGameGesture = (
    x: number,
    y: number,
    down: boolean,
    last: boolean,
    timeStamp: number,
  ) => {
    const mx = x - gesture.current.startX;
    const my = y - gesture.current.startY;
    gesture.current.lastX = x;
    gesture.current.lastY = y;
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
    // Grounded launch: hold-to-charge along the certified next-hop parabola. Direction is
    // route-derived; dragging the held finger down scrubs/cancels charge instead of steering.
    if (down) {
      if (gesture.current.groundedCancelled) {
        setCharge(0);
        setAim(null);
        return;
      }
      chargingRef.current = true;
      setCharging(true);
      const req = publishRouteCharge(timeStamp, false, y, tap);
      if (!req && gesture.current.groundedCancelled) {
        chargingRef.current = false;
        setCharging(false);
      }
      return;
    }

    chargingRef.current = false;
    setCharging(false);
    const req = gesture.current.groundedCancelled
      ? null
      : publishRouteCharge(timeStamp, true, y, tap);
    setAim(null);
    setCharge(0);
    if (last && req && req.charge > 0.05) {
      requestLaunch(req);
    }
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const now = performance.now();
    if (pointers.current.size >= 2) {
      gesture.current.mode = "pinch";
      gesture.current.pinchDistance = pointerDistance();
      gesture.current.pinchZoom = getViewControls().zoom;
      chargingRef.current = false;
      setCharging(false);
      setAim(null);
      setCharge(0);
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
      startTime: now,
      moved: false,
      pinchDistance: 1,
      pinchZoom: getViewControls().zoom,
      groundedChargePeak: 0,
      groundedCancelled: false,
    };
    if (mode === "game") updateGameGesture(e.clientX, e.clientY, true, false, now);
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

    updateGameGesture(e.clientX, e.clientY, true, false, performance.now());
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const pointer = pointers.current.get(e.pointerId);
    if (!pointer) return;
    e.preventDefault();
    const now = performance.now();
    if (gesture.current.mode === "game") {
      updateGameGesture(e.clientX, e.clientY, false, true, now);
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
          startTime: now,
          moved: false,
          pinchDistance: 1,
          pinchZoom: getViewControls().zoom,
          groundedChargePeak: 0,
          groundedCancelled: false,
        };
      }
    }
  };

  const onPointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    e.preventDefault();
    const now = performance.now();
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
          startTime: now,
          moved: false,
          pinchDistance: 1,
          pinchZoom: getViewControls().zoom,
          groundedChargePeak: 0,
          groundedCancelled: false,
        };
      }
    }
    setAim(null);
    setAirSteer(0, 0);
    setCharge(0);
    chargingRef.current = false;
    setCharging(false);
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
      aria-label="Launch area — hold on the blob to charge, release to fling, or pull down below the blob to cancel; drag off the blob to rotate the view; pinch or wheel to zoom"
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
          className="absolute left-1/2 flex -translate-x-1/2 flex-col items-center gap-1"
          style={{ bottom: "calc(var(--safe-bottom, 0px) + 2.75rem)" }}
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
