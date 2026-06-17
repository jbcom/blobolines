/**
 * Wind-gust hazard (pure). High up in the stratosphere band the air gets gusty: a slowly-
 * varying horizontal force pushes the airborne blob sideways, so the player has to fight the
 * drift to stay on the golden path — a navigational hazard gated by altitude, not a pad type.
 * Deterministic given (height, time): a smooth sinusoid (no RNG) so it reads as a steady gust
 * that swells and eases, the same on every replay. Returns a world X/Z acceleration.
 *
 * Below WIND_START it's zero (calm climb); it ramps in over WIND_RAMP and holds at full gust
 * strength above. Direction rotates slowly so it's not a constant one-way shove.
 */

export const WIND_START = 600; // stratosphere — matches the biome band where it gets gusty
const WIND_RAMP = 200; // metres over which the gust ramps from 0 → full
const WIND_ACCEL = 9; // peak lateral acceleration (m/s²) — strong enough to feel, not unfair

export function windAt(height: number, time: number): readonly [number, number] {
  if (height <= WIND_START) return [0, 0];
  const ramp = Math.min(1, (height - WIND_START) / WIND_RAMP);
  // Gust envelope swells + eases (never fully calm above the start); direction drifts slowly.
  const gust = (0.55 + 0.45 * Math.sin(time * 0.6)) * ramp * WIND_ACCEL;
  const dir = time * 0.18; // slow rotation of the wind heading
  return [Math.cos(dir) * gust, Math.sin(dir) * gust];
}

// ── Downdraft hazard (2nd hazard) ────────────────────────────────────────────────
/** Band where periodic downdrafts pull the blob down — the "space" approach (upper
 *  stratosphere into space), a distinct vertical hazard from the lateral wind gust. */
export const DOWNDRAFT_START = 950; // the space band
const DOWNDRAFT_RAMP = 300;
const DOWNDRAFT_ACCEL = 12; // peak extra downward pull (m/s²)

/**
 * Downward acceleration (≥0, applied as -Y) from periodic downdrafts in the space band — a
 * pulsing extra gravity that threatens to drag the blob back down, so the player can't dawdle
 * up high. Zero below DOWNDRAFT_START; ramps in; PULSES (sin² so it's mostly calm with strong
 * surges, not a constant heavy-gravity tax). Pure + deterministic. Capped so a clean bounce
 * always still out-climbs it.
 */
export function downdraftAt(height: number, time: number): number {
  if (height <= DOWNDRAFT_START) return 0;
  const ramp = Math.min(1, (height - DOWNDRAFT_START) / DOWNDRAFT_RAMP);
  const pulse = Math.sin(time * 0.9) ** 2; // 0..1, mostly low with periodic surges
  return ramp * pulse * DOWNDRAFT_ACCEL;
}
