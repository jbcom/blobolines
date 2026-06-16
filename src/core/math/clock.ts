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
  const maxDelta = options.maxDelta ?? 1 / 30;
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
      const dt = Math.min(Math.max(0, now - last), maxDelta);
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
