/**
 * Engine clock facade. Sim/engine code reads time from here, never `performance.now()`
 * directly (gates.json bans it in src/sim & src/engine) — so headless tests can drive
 * a deterministic clock and replays stay reproducible.
 */

export interface Clock {
  /** Seconds since the clock was created/reset. */
  elapsed(): number;
  /** Seconds since the previous `tick()`; clamped to `maxDelta`. */
  tick(nowSeconds: number): number;
  reset(nowSeconds?: number): void;
}

export interface ClockOptions {
  /** Max delta returned by tick(), to avoid huge steps after a stall. Default 1/15. */
  maxDelta?: number;
}

export function createClock(options: ClockOptions = {}): Clock {
  const maxDelta = options.maxDelta ?? 1 / 15;
  let start = 0;
  let last = 0;
  let initialized = false;

  return {
    elapsed: () => (initialized ? last - start : 0),
    tick: (now) => {
      if (!initialized) {
        start = now;
        last = now;
        initialized = true;
        return 0;
      }
      const dt = Math.min(Math.max(0, now - last), maxDelta);
      last = now;
      return dt;
    },
    reset: (now = 0) => {
      start = now;
      last = now;
      initialized = false;
    },
  };
}
