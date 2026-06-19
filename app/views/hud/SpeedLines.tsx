import { useEffect, useRef } from "react";
import { getBlobDiagnostics } from "@/state";

/**
 * SpeedLines — a DOM overlay that fades in radial motion streaks from the screen edges when
 * the blob is moving fast (above a velocity threshold), selling the sense of speed on a big
 * launch/fall without a 3D particle system. A repeating-conic streak texture masked to a
 * vignette ring; its opacity tracks blob speed via the diagnostics bridge in a rAF loop (no
 * React re-render). Decorative → fully off under prefers-reduced-motion.
 */
const SPEED_ON = 14; // m/s where streaks start to appear
const SPEED_FULL = 34; // m/s for full-strength streaks
const MAX_OPACITY = 0.5;

export function SpeedLines() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return; // streaks are pure motion — skip entirely

    let raf = 0;
    let cur = 0; // smoothed opacity
    let wasActive = false;
    let prev = performance.now();
    const tick = (now: number) => {
      const dt = Math.min((now - prev) / 1000, 1 / 15);
      prev = now;

      const { speed } = getBlobDiagnostics();
      const target =
        speed <= SPEED_ON
          ? 0
          : Math.min(1, (speed - SPEED_ON) / (SPEED_FULL - SPEED_ON)) * MAX_OPACITY;
      // Critically-damped ease so streaks fade in/out smoothly, not pop.
      cur += (target - cur) * Math.min(1, dt / 0.12);

      const el = ref.current;
      if (el && (cur > 0.001 || wasActive)) {
        if (cur <= 0.001) {
          el.style.opacity = "0";
          wasActive = false;
        } else {
          el.style.opacity = String(cur);
          wasActive = true;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none absolute inset-0 z-flash"
      style={{
        opacity: 0,
        // Fine white streaks radiating outward, masked to the screen edges (clear center) so
        // they frame the action without obscuring the blob — a speed-tunnel feel.
        background:
          "repeating-conic-gradient(from 0deg at 50% 50%, rgba(255,255,255,0.5) 0deg 0.6deg, transparent 0.6deg 4deg)",
        maskImage: "radial-gradient(ellipse 60% 60% at 50% 50%, transparent 55%, black 100%)",
        WebkitMaskImage: "radial-gradient(ellipse 60% 60% at 50% 50%, transparent 55%, black 100%)",
      }}
    />
  );
}
