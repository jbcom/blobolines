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
