import { achievementById } from "@/sim/achievements";

export interface AchievementToast {
  id: number;
  achievementId: string;
  title: string;
  description: string;
}

let nextId = 0;
// FIFO queue, not a single slot: multiple achievements can unlock in one frame (e.g. when
// commitBestHeight runs at run end), and a single `current` would drop all but the last.
// `getAchievementToast` exposes the head; `clearAchievementToast` dequeues so the next shows.
let queue: AchievementToast[] = [];
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) {
    listener();
  }
}

/**
 * Report a newly unlocked achievement to be toasted. Enqueues so simultaneous unlocks all
 * get shown in turn rather than overwriting each other.
 */
export function reportAchievementToast(achievementId: string): void {
  const achievement = achievementById(achievementId);
  if (!achievement) return;

  queue.push({
    id: ++nextId,
    achievementId,
    title: achievement.title,
    description: achievement.description,
  });
  emit();
}

/**
 * Get the head of the toast queue (the achievement currently being shown), or null if empty.
 */
export function getAchievementToast(): AchievementToast | null {
  return queue[0] ?? null;
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
 * Dismiss the current (head) toast and advance to the next queued one. Emits so the consumer
 * re-renders with the next toast (or null when the queue drains).
 */
export function clearAchievementToast(): void {
  queue.shift();
  emit();
}

/**
 * Reset the toast queue (run end). Drops any pending toasts so they don't fire on the next run.
 */
export function resetAchievementToasts(): void {
  if (queue.length === 0) return;
  queue = [];
  emit();
}
