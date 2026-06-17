import type { TrampType } from "@/core/types";

export type RouteLandingGrade = "perfect" | "great" | "clean" | "edge";

export interface RouteLandingFeedback {
  id: number;
  quality: number;
  bonus: number;
  miss: number;
  halfFootprint: number;
  sourceMode: "flat" | "canted" | "moving" | "wobbler";
  targetType: TrampType;
  grade: RouteLandingGrade;
}

let nextId = 0;
let current: RouteLandingFeedback | null = null;
const listeners = new Set<() => void>();

export function routeLandingGrade(quality: number): RouteLandingGrade {
  if (quality >= 0.9) return "perfect";
  if (quality >= 0.72) return "great";
  if (quality >= 0.42) return "clean";
  return "edge";
}

function emit(): void {
  for (const listener of listeners) listener();
}

export function reportRouteLandingFeedback(
  feedback: Omit<RouteLandingFeedback, "id" | "grade">,
): RouteLandingFeedback {
  current = {
    ...feedback,
    id: ++nextId,
    grade: routeLandingGrade(feedback.quality),
  };
  emit();
  return current;
}

export function getRouteLandingFeedback(): RouteLandingFeedback | null {
  return current;
}

export function subscribeRouteLandingFeedback(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function clearRouteLandingFeedback(): void {
  current = null;
  emit();
}
