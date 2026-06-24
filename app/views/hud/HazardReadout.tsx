import { ArrowDown, ArrowUp, Wind } from "lucide-react";
import { useEffect, useRef } from "react";
import type { HazardDiagnostics } from "@/state";
import { getBlobDiagnostics } from "@/state";

const VISIBLE_INTENSITY = 0.06;

export interface HazardReadoutState {
  windActive: boolean;
  downdraftActive: boolean;
  windHeadingDeg: number;
  windDirection: string;
  windPercent: string;
  downdraftPercent: string;
  ariaLabel: string;
}

function percent(intensity: number): string {
  return `${Math.round(Math.max(0, Math.min(1, intensity)) * 100)}%`;
}

function directionLabel(wx: number, wz: number): string {
  const horizontal = Math.hypot(wx, wz);
  if (horizontal < 0.001) return "calm";

  const x = wx > 0 ? "right" : "left";
  const z = wz > 0 ? "back" : "forward";
  const ax = Math.abs(wx);
  const az = Math.abs(wz);

  if (ax > az * 1.7) return x;
  if (az > ax * 1.7) return z;
  return `${z} ${x}`;
}

export function hazardReadoutState(hazards?: HazardDiagnostics): HazardReadoutState | null {
  const windIntensity = hazards?.windIntensity ?? 0;
  const downdraftIntensity = hazards?.downdraftIntensity ?? 0;
  const windActive = windIntensity >= VISIBLE_INTENSITY;
  const downdraftActive = downdraftIntensity >= VISIBLE_INTENSITY;
  if (!windActive && !downdraftActive) return null;

  const wind = hazards?.wind ?? [0, 0];
  const windDirection = directionLabel(wind[0], wind[1]);
  const windPercent = percent(windIntensity);
  const downdraftPercent = percent(downdraftIntensity);
  const parts = [
    windActive ? `wind pushing ${windDirection} at ${windPercent}` : null,
    downdraftActive ? `downdraft at ${downdraftPercent}` : null,
  ].filter(Boolean);

  return {
    windActive,
    downdraftActive,
    windHeadingDeg: (Math.atan2(wind[0], -wind[1]) * 180) / Math.PI,
    windDirection,
    windPercent,
    downdraftPercent,
    ariaLabel: `Climb hazards: ${parts.join(", ")}`,
  };
}

/**
 * Compact late-run hazard readout. Wind/downdraft already affect the sim; this makes that force
 * legible so a high-altitude miss reads as a counterable climb condition, not mysterious drift.
 */
export function HazardReadout() {
  const rootRef = useRef<HTMLDivElement>(null);
  const windRowRef = useRef<HTMLDivElement>(null);
  const downRowRef = useRef<HTMLDivElement>(null);
  const windValueRef = useRef<HTMLSpanElement>(null);
  const downValueRef = useRef<HTMLSpanElement>(null);
  const windArrowRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    let raf = 0;
    let active = true;
    const tick = () => {
      if (!active) return;
      const state = hazardReadoutState(getBlobDiagnostics().hazards);
      const root = rootRef.current;

      if (!state) {
        if (root) {
          root.style.opacity = "0";
          root.setAttribute("aria-label", "No active climb hazards");
        }
        if (windRowRef.current) windRowRef.current.style.display = "none";
        if (downRowRef.current) downRowRef.current.style.display = "none";
      } else {
        if (root) {
          root.style.opacity = "1";
          root.setAttribute("aria-label", state.ariaLabel);
        }
        if (windRowRef.current) {
          windRowRef.current.style.display = state.windActive ? "flex" : "none";
        }
        if (downRowRef.current) {
          downRowRef.current.style.display = state.downdraftActive ? "flex" : "none";
        }
        if (windValueRef.current) windValueRef.current.textContent = state.windPercent;
        if (downValueRef.current) downValueRef.current.textContent = state.downdraftPercent;
        if (windArrowRef.current) {
          windArrowRef.current.style.transform = `rotate(${state.windHeadingDeg}deg)`;
        }
      }

      raf = requestAnimationFrame(tick);
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
      data-testid="hazard-readout"
      role="status"
      aria-live="polite"
      aria-label="No active climb hazards"
      className="pointer-events-none flex min-w-36 flex-col gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 font-ui text-cream shadow-[var(--shadow-sm)] backdrop-blur-md transition-opacity duration-150"
      style={{ opacity: 0 }}
    >
      <div
        ref={windRowRef}
        className="flex items-center justify-between gap-3"
        style={{ display: "none" }}
      >
        <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-fg-subtle">
          <Wind className="size-3.5" aria-hidden />
          Wind
        </span>
        <span className="flex items-center gap-1 font-display text-sm font-black text-tramp-gold">
          <ArrowUp
            ref={windArrowRef}
            className="size-3.5 transition-transform duration-100"
            aria-hidden
          />
          <span ref={windValueRef} />
        </span>
      </div>
      <div
        ref={downRowRef}
        className="flex items-center justify-between gap-3"
        style={{ display: "none" }}
      >
        <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-fg-subtle">
          <ArrowDown className="size-3.5" aria-hidden />
          Downdraft
        </span>
        <span ref={downValueRef} className="font-display text-sm font-black text-danger" />
      </div>
    </div>
  );
}
