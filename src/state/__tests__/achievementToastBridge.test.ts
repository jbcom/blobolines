import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearAchievementToast,
  getAchievementToast,
  reportAchievementToast,
  resetAchievementToasts,
  subscribeAchievementToast,
} from "../achievementToastBridge";

afterEach(() => resetAchievementToasts());

describe("achievementToastBridge queue", () => {
  it("returns null when nothing is queued", () => {
    expect(getAchievementToast()).toBeNull();
  });

  it("shows a reported achievement at the head", () => {
    reportAchievementToast("height-100");
    expect(getAchievementToast()?.achievementId).toBe("height-100");
  });

  it("ignores unknown achievement ids", () => {
    reportAchievementToast("not-a-real-achievement");
    expect(getAchievementToast()).toBeNull();
  });

  it("queues simultaneous unlocks and surfaces them one at a time in order", () => {
    // The HIGH-priority regression: three unlocks in one frame must all show, not just the last.
    reportAchievementToast("height-100");
    reportAchievementToast("height-250");
    reportAchievementToast("height-500");

    expect(getAchievementToast()?.achievementId).toBe("height-100");
    clearAchievementToast();
    expect(getAchievementToast()?.achievementId).toBe("height-250");
    clearAchievementToast();
    expect(getAchievementToast()?.achievementId).toBe("height-500");
    clearAchievementToast();
    expect(getAchievementToast()).toBeNull();
  });

  it("gives every toast a unique id even for the same achievement", () => {
    reportAchievementToast("height-100");
    const first = getAchievementToast()?.id;
    clearAchievementToast();
    reportAchievementToast("height-100");
    const second = getAchievementToast()?.id;
    expect(first).not.toBe(second);
  });

  it("notifies subscribers on report and on clear", () => {
    const listener = vi.fn();
    const unsub = subscribeAchievementToast(listener);
    reportAchievementToast("height-100");
    expect(listener).toHaveBeenCalledTimes(1);
    clearAchievementToast();
    expect(listener).toHaveBeenCalledTimes(2);
    unsub();
    reportAchievementToast("height-250");
    expect(listener).toHaveBeenCalledTimes(2); // no longer subscribed
  });

  it("resetAchievementToasts drains the whole queue", () => {
    reportAchievementToast("height-100");
    reportAchievementToast("height-250");
    resetAchievementToasts();
    expect(getAchievementToast()).toBeNull();
  });
});
