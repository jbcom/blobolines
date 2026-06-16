import { describe, expect, it } from "vitest";
import type { TrampolineSpec } from "@/core/types";
import { WINDOW_ABOVE, WINDOW_BELOW, windowedPads } from "../TrampolineField";

const pad = (y: number): TrampolineSpec => ({
  id: y,
  position: [0, y, 0],
  width: 6,
  depth: 6,
  type: "standard",
});

describe("windowedPads", () => {
  const tower = Array.from({ length: 200 }, (_, i) => pad(i * 5)); // 0..995

  it("keeps only pads within [center-below, center+above]", () => {
    const center = 300;
    const win = windowedPads(tower, center);
    for (const t of win) {
      expect(t.position[1]).toBeGreaterThanOrEqual(center - WINDOW_BELOW);
      expect(t.position[1]).toBeLessThanOrEqual(center + WINDOW_ABOVE);
    }
  });

  it("culls pads far below and far above the blob", () => {
    const win = windowedPads(tower, 300);
    expect(win.some((t) => t.position[1] < 300 - WINDOW_BELOW)).toBe(false);
    expect(win.some((t) => t.position[1] > 300 + WINDOW_ABOVE)).toBe(false);
  });

  it("keeps the live pad count bounded regardless of altitude", () => {
    const low = windowedPads(tower, 50).length;
    const high = windowedPads(tower, 800).length;
    // The window spans a fixed Y range, so the count is roughly constant (±1 pad) — it
    // does NOT grow with how high the blob has climbed. That's the whole perf point.
    expect(Math.abs(high - low)).toBeLessThanOrEqual(1);
    expect(high).toBeLessThan(tower.length); // genuinely culling
  });

  it("includes the starter pad when the blob is near the ground", () => {
    const win = windowedPads([pad(0), ...tower], 0);
    expect(win.some((t) => t.id === 0)).toBe(true);
  });
});
