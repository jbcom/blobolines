export interface IdlePatienceInput {
  idleSeconds: number;
  dt: number;
  resting: boolean;
  aiming: boolean;
  playerControlStarted: boolean;
  autoLaunchDelay: number;
}

export interface IdlePatienceStep {
  idleSeconds: number;
  shouldAutoLaunch: boolean;
}

/**
 * Track visual pad-idle time separately from the auto-launch permission gate. Blobby should
 * get visibly impatient before the first launch, but the first launch still belongs to the
 * player; auto-launch only starts after the run has received real player control.
 */
export function stepIdlePatience({
  idleSeconds,
  dt,
  resting,
  aiming,
  playerControlStarted,
  autoLaunchDelay,
}: IdlePatienceInput): IdlePatienceStep {
  if (!resting || aiming) return { idleSeconds: 0, shouldAutoLaunch: false };

  const next = Math.max(0, idleSeconds) + Math.max(0, dt);
  if (playerControlStarted && next >= autoLaunchDelay) {
    return { idleSeconds: 0, shouldAutoLaunch: true };
  }

  return { idleSeconds: next, shouldAutoLaunch: false };
}
