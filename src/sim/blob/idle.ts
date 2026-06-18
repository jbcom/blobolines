export interface IdlePatienceInput {
  idleSeconds: number;
  dt: number;
  resting: boolean;
  aiming: boolean;
}

export interface IdlePatienceStep {
  idleSeconds: number;
}

/**
 * Track visual pad-idle time for Blobby's impatient animation. Waiting on a pad must never
 * launch for the player; release input is the only grounded launch trigger.
 */
export function stepIdlePatience({
  idleSeconds,
  dt,
  resting,
  aiming,
}: IdlePatienceInput): IdlePatienceStep {
  if (!resting || aiming) return { idleSeconds: 0 };

  const next = Math.max(0, idleSeconds) + Math.max(0, dt);
  return { idleSeconds: next };
}

export interface HeroIdleBurble {
  scale: { x: number; y: number; z: number };
  offsetY: number;
  excitement: number;
  idleSeconds: number;
  sag: number;
  lobe: number;
}

/**
 * Deterministic menu-idle character loop: Blobby settles into a flat happy puddle, then perks
 * back into a tall excited blob with small burbling asymmetry. This is visual-only; player
 * launch intent still comes exclusively from hold/release input.
 */
export function heroIdleBurble(time: number, intensity = 1): HeroIdleBurble {
  const t = Math.max(0, time);
  const amount = Math.min(1, Math.max(0, intensity));
  const rise = (Math.sin(t * 1.18 - 0.55) + 1) * 0.5;
  const burble = (Math.sin(t * 2.75 + 0.6) + 1) * 0.5;
  const twitch = (Math.sin(t * 4.15 + 1.1) + 1) * 0.5;
  const perky = Math.max(0, Math.sin(t * 1.18 - 0.15)) ** 2;
  const flat = 1 - rise;

  return {
    scale: {
      x: 1 + amount * (flat * 0.24 - perky * 0.08 + burble * 0.045),
      y: 1 + amount * (-flat * 0.24 + perky * 0.28 + twitch * 0.045),
      z: 1 + amount * (flat * 0.18 - perky * 0.06 + (1 - burble) * 0.055),
    },
    offsetY: amount * (-flat * 0.08 + perky * 0.12 + burble * 0.025),
    excitement: Math.min(1, amount * (0.18 + perky * 0.5 + burble * 0.22)),
    idleSeconds: 2.8 + t * amount,
    sag: amount * (0.22 + flat * 0.34),
    lobe: amount * (0.28 + burble * 0.16 + perky * 0.22),
  };
}
