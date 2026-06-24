import { describe, expect, it } from "vitest";
import { syncHighContrastDataset, syncReducedMotionDataset } from "../App";

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

describe("syncHighContrastDataset", () => {
  it("mirrors the in-app high-contrast setting onto the root dataset", () => {
    const root = document.createElement("html");
    const cleanup = syncHighContrastDataset(true, root);
    expect(root.dataset.highContrast).toBe("true");
    cleanup();
    expect(root.dataset.highContrast).toBeUndefined();
  });

  it("writes false when high contrast is disabled", () => {
    const root = document.createElement("html");
    syncHighContrastDataset(false, root);
    expect(root.dataset.highContrast).toBe("false");
  });
});
