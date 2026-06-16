import { animate } from "animejs";
import { type RefObject, useEffect, useRef } from "react";

/**
 * anime.js micro-interaction: punch an element (quick scale + rotate kick that springs
 * back) every time `value` changes — the imperative, fire-and-forget juice anime.js is
 * built for, distinct from Motion's declarative layout transitions. Skips the very first
 * render so a freshly-mounted badge doesn't punch on appear (Motion handles the entrance).
 *
 * Returns a ref to attach to the element you want to punch.
 *
 * @param value     the value whose change triggers the punch (e.g. a combo count)
 * @param opts.scale  peak scale of the kick (default 1.35)
 * @param opts.rotate peak rotation in deg, alternating sign per punch (default 0)
 */
export function usePunchOnChange<T extends HTMLElement>(
  value: unknown,
  opts: { scale?: number; rotate?: number } = {},
): RefObject<T | null> {
  const ref = useRef<T>(null);
  const first = useRef(true);
  const flip = useRef(1);
  const { scale = 1.35, rotate = 0 } = opts;

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const el = ref.current;
    if (!el) return;
    // Honor prefers-reduced-motion (Motion's config doesn't reach anime.js) — skip the
    // punch entirely; the underlying value still updates, just without the kick.
    if (
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    flip.current *= -1;
    const r = rotate * flip.current;
    animate(el, {
      scale: [1, scale, 1],
      rotate: rotate ? [0, r, 0] : 0,
      duration: 420,
      ease: "outElastic(1, 0.6)",
    });
  }, [value, scale, rotate]);

  return ref;
}
