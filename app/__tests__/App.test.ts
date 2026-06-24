import { describe, expect, it } from "vitest";
import { syncReducedMotionDataset } from "../App";

describe("syncReducedMotionDataset", () => {
  it("mirrors the in-app reduced-motion setting onto the root dataset", () => {
    const root = document.createElement("html");
    const cleanup = syncReducedMotionDataset(true, root);
    expect(root.dataset.reducedMotion).toBe("true");
    cleanup();
    expect(root.dataset.reducedMotion).toBeUndefined();
  });

  it("writes false when motion is allowed", () => {
    const root = document.createElement("html");
    syncReducedMotionDataset(false, root);
    expect(root.dataset.reducedMotion).toBe("false");
  });
});
