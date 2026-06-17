import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearRouteLandingFeedback,
  getRouteLandingFeedback,
  reportRouteLandingFeedback,
  routeLandingGrade,
  subscribeRouteLandingFeedback,
} from "../routeFeedbackBridge";

afterEach(() => clearRouteLandingFeedback());

describe("routeLandingGrade", () => {
  it("maps route quality to player-readable landing grades", () => {
    expect(routeLandingGrade(0.95)).toBe("perfect");
    expect(routeLandingGrade(0.8)).toBe("great");
    expect(routeLandingGrade(0.5)).toBe("clean");
    expect(routeLandingGrade(0.1)).toBe("edge");
  });
});

describe("route landing feedback bridge", () => {
  it("stores the latest landing feedback and notifies subscribers", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeRouteLandingFeedback(listener);

    const feedback = reportRouteLandingFeedback({
      quality: 0.8,
      bonus: 42,
      miss: 1,
      halfFootprint: 5,
      sourceMode: "canted",
      targetType: "moving",
    });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(getRouteLandingFeedback()).toEqual(feedback);
    expect(feedback.grade).toBe("great");

    unsubscribe();
    clearRouteLandingFeedback();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(getRouteLandingFeedback()).toBeNull();
  });
});
