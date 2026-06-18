import { Navigation } from "lucide-react";
import { useEffect, useRef } from "react";
import type { TrampolineSpec, Vec3 } from "@/core/types";
import { getBlobDiagnostics, nextRouteStep, useWorldStore } from "@/state";

const CLOSE_HORIZONTAL = 1.25;

export interface NextPadGuidance {
  target: TrampolineSpec;
  dx: number;
  dz: number;
  dy: number;
  horizontal: number;
  headingDeg: number;
  direction: string;
}

function directionLabel(dx: number, dz: number, horizontal: number): string {
  if (horizontal < CLOSE_HORIZONTAL) return "centered";

  const x = dx > 0 ? "right" : "left";
  const z = dz > 0 ? "back" : "forward";
  const ax = Math.abs(dx);
  const az = Math.abs(dz);

  if (ax > az * 1.7) return x;
  if (az > ax * 1.7) return z;
  return `${z} ${x}`;
}

export function nextPadGuidance(
  blobPosition: Vec3,
  groundY: number,
  pads: readonly TrampolineSpec[],
): NextPadGuidance | null {
  const step = nextRouteStep(groundY, pads);
  const target = step?.target;
  if (!target) return null;

  const dx = target.position[0] - blobPosition[0];
  const dz = target.position[2] - blobPosition[2];
  const dy = target.position[1] - blobPosition[1];
  const horizontal = Math.hypot(dx, dz);
  // Compass convention for the HUD: up is world forward (-Z), right is +X.
  const headingDeg = (Math.atan2(dx, -dz) * 180) / Math.PI;

  return {
    target,
    dx,
    dz,
    dy,
    horizontal,
    headingDeg,
    direction: directionLabel(dx, dz, horizontal),
  };
}

function meters(n: number): string {
  const rounded = Math.round(Math.abs(n));
  if (rounded === 0) return "+0m";
  return `${n >= 0 ? "+" : "-"}${rounded}m`;
}

/**
 * Compact spatial-awareness readout for the next cloud pad. It reads the per-frame
 * diagnostics bridge and world store from a rAF loop, then writes DOM text/styles
 * imperatively so the radar can update smoothly without React re-rendering every frame.
 */
export function NextPadRadar() {
  const rootRef = useRef<HTMLDivElement>(null);
  const arrowRef = useRef<HTMLSpanElement>(null);
  const directionRef = useRef<HTMLSpanElement>(null);
  const verticalRef = useRef<HTMLSpanElement>(null);
  const horizontalRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let raf = 0;
    let active = true;
    const tick = () => {
      if (!active) return;
      const diag = getBlobDiagnostics();
      const guidance = nextPadGuidance(
        diag.position,
        diag.groundY,
        useWorldStore.getState().trampolines,
      );

      const root = rootRef.current;
      if (root) {
        if (!guidance) {
          root.style.opacity = "0";
          root.setAttribute("aria-label", "No next cloud target");
        } else {
          root.style.opacity = "1";
          root.setAttribute(
            "aria-label",
            `Next cloud ${guidance.direction}, ${meters(guidance.dy)} vertical, ${Math.round(
              guidance.horizontal,
            )} meters away`,
          );
        }
      }

      if (guidance) {
        if (arrowRef.current) {
          arrowRef.current.style.transform = `rotate(${guidance.headingDeg}deg)`;
        }
        if (directionRef.current) directionRef.current.textContent = guidance.direction;
        if (verticalRef.current) verticalRef.current.textContent = meters(guidance.dy);
        if (horizontalRef.current)
          horizontalRef.current.textContent = `${Math.round(guidance.horizontal)}m`;
      }

      if (active) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      active = false;
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      ref={rootRef}
      data-testid="next-pad-radar"
      role="img"
      aria-label="Next cloud target"
      className="pointer-events-none flex min-w-40 items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2 text-cream shadow-[var(--shadow-sm)] backdrop-blur-md transition-opacity duration-150"
      style={{ opacity: 0 }}
    >
      <span
        ref={arrowRef}
        className="grid size-10 place-items-center rounded-full border border-accent/45 bg-accent/15 text-accent shadow-[var(--glow-blue)] transition-transform duration-100"
        aria-hidden
      >
        <Navigation className="size-5" strokeWidth={2.6} />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-fg-subtle">
          Next cloud
        </span>
        <span className="flex items-baseline gap-2">
          <span ref={directionRef} className="font-display text-base font-bold leading-none" />
          <span ref={verticalRef} className="text-xs font-bold text-tramp-gold" />
        </span>
        <span ref={horizontalRef} className="text-[10px] font-semibold text-fg-muted" />
      </span>
    </div>
  );
}
