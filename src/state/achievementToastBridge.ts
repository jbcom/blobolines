import { achievementById } from "@/sim/achievements";

export interface AchievementToast {
  id: number;
  achievementId: string;
  title: string;
  description: string;
}

let nextId = 0;
let current: AchievementToast | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) {
    listener();
  }
}

/**
 * Report a newly unlocked achievement to be toasted.
 */
export function reportAchievementToast(achievementId: string): void {
  const achievement = achievementById(achievementId);
  if (!achievement) return;

  current = {
    id: ++nextId,
    achievementId,
    title: achievement.title,
    description: achievement.description,
  };
  emit();
}

/**
 * Get the current active achievement toast request.
 */
export function getAchievementToast(): AchievementToast | null {
  return current;
}

/**
 * Subscribe to achievement toast events.
 */
export function subscribeAchievementToast(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Clear the current achievement toast.
 */
export function clearAchievementToast(): void {
  current = null;
  emit();
}
