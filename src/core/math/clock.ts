/**
 * Engine clock facade. Sim/engine code reads time from here, never `performance.now()`
 * directly (gates.json bans it in src/sim & src/engine) — so headless tests can drive
 * a deterministic clock and replays stay reproducible.
 */

export interface Clock {
  /** Accumulated SIM time: the sum of clamped tick() deltas, not wall-clock. Safe for
   *  replay/scoring — after a stall it advances by the clamped delta, not real time. */
  elapsed(): number;
  /** Seconds since the previous `tick()`; clamped to `maxDelta`. */
  tick(nowSeconds: number): number;
  reset(nowSeconds?: number): void;
}

export interface ClockOptions {
  /** Max delta returned by tick(), to avoid huge steps after a stall. Default 1/30 —
   *  kept below the stability threshold of the documented spring configs so a frame
   *  stall (e.g. tab backgrounding) never blows up spring integration. */
  maxDelta?: number;
}

export function createClock(options: ClockOptions = {}): Clock {
  // Clamp to a positive value — a negative maxDelta would make tick() return negative
  // deltas and destabilize the sim.
  const maxDelta = Math.max(options.maxDelta ?? 1 / 30, 1e-6);
  let last = 0;
  let simElapsed = 0;
  let initialized = false;

  return {
    elapsed: () => simElapsed,
    tick: (now) => {
      if (!initialized) {
        last = now;
        initialized = true;
        return 0;
      }
      // Backward time → 0 delta, and DON'T rewind `last` (rewinding would create an
      // artificial positive spike on the next forward tick).
      if (now <= last) return 0;
      const dt = Math.min(now - last, maxDelta);
      last = now;
      simElapsed += dt;
      return dt;
    },
    reset: (now = 0) => {
      last = now;
      simElapsed = 0;
      initialized = false;
    },
  };
}
