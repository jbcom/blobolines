import { useEffect, useRef } from "react";
import { consumeFlash, type FlashKind } from "@/state";
import { palette } from "@/styles/tokens";

/**
 * Full-screen flash overlay on the --z-flash layer. Gameplay fires `flash(kind, intensity)`
 * (gold = combo escalation, blue = big launch, red = near-death) and this consumes the
 * latest request each frame and pulses the screen — gold/blue as a soft full-screen tint,
 * red as a danger vignette creeping in from the edges. Driven by a rAF loop reading the
 * bridge + writing styles directly, so flashes never cause a React re-render.
 *
 * prefers-reduced-motion: flashes are decorative, so honor it by skipping the pulse.
 */
const COLORS: Record<FlashKind, string> = {
  gold: palette.tramp.gold,
  blue: palette.sky.mid,
  red: palette.danger,
};

export function ScreenFlash() {
  const ref = useRef<HTMLDivElement>(null);
  /** Current decaying flash envelope. */
  const env = useRef(0);
  const kind = useRef<FlashKind>("gold");

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    let raf = 0;
    let prev = performance.now();
    const tick = (now: number) => {
      const dt = Math.min((now - prev) / 1000, 1 / 15);
      prev = now;

      const req = consumeFlash();
      if (req && !reduced) {
        kind.current = req.kind;
        env.current = Math.max(env.current, req.intensity);
      }
      // Decay the envelope (~0.4s fade).
      env.current = Math.max(0, env.current - dt / 0.4);

      const el = ref.current;
      if (el) {
        const e = env.current;
        const c = COLORS[kind.current];
        if (kind.current === "red") {
          // Danger: a vignette pulsing in from the edges (transparent center).
          el.style.background = `radial-gradient(ellipse at center, transparent 45%, ${c} 140%)`;
          el.style.opacity = String(Math.min(0.6, e * 0.6));
        } else {
          // Gold/blue: a soft uniform screen tint.
          el.style.background = c;
          el.style.opacity = String(Math.min(0.35, e * 0.35));
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
      className="pointer-events-none absolute inset-0"
      style={{ zIndex: "var(--z-flash)" as unknown as number, opacity: 0 }}
    />
  );
}
