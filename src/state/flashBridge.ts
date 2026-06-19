/**
 * Screen-flash bridge — a one-shot full-screen color pulse decoupled from React renders.
 * Gameplay code fires `flash(kind, intensity)` (combo escalation = gold, big launch =
 * blue, near-death = red), and the ScreenFlash overlay consumes the latest request each
 * frame to drive its animation. Imperative so a flash never triggers a per-frame re-render.
 */

export type FlashKind = "gold" | "blue" | "red" | "white";

export interface FlashRequest {
  kind: FlashKind;
  /** 0..1 strength — scales opacity/scale of the pulse. */
  intensity: number;
}

let pending: FlashRequest | null = null;

/** Fire a screen flash. The strongest pending request in a frame wins. */
export function flash(kind: FlashKind, intensity = 1): void {
  const i = Math.max(0, Math.min(1, intensity));
  if (!pending || i >= pending.intensity) pending = { kind, intensity: i };
}

/** Consume the pending flash (returns it once, then clears). */
export function consumeFlash(): FlashRequest | null {
  const f = pending;
  pending = null;
  return f;
}

/** Clear any pending flash (run reset). */
export function resetFlash(): void {
  pending = null;
}
