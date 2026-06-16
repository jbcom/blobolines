import { beforeEach, describe, expect, it } from "vitest";
import { useWorldStore } from "../worldStore";

describe("worldStore.ensureHeight", () => {
  beforeEach(() => useWorldStore.getState().reset(1));

  it("extends the tower and advances highestY", () => {
    const before = useWorldStore.getState().highestY;
    useWorldStore.getState().ensureHeight(before + 500);
    expect(useWorldStore.getState().highestY).toBeGreaterThan(before);
  });

  it("is a no-op when the target is already generated", () => {
    const { highestY, trampolines } = useWorldStore.getState();
    useWorldStore.getState().ensureHeight(highestY - 10);
    expect(useWorldStore.getState().trampolines).toBe(trampolines); // same ref, untouched
  });

  it("keeps the trampoline list bounded over a long climb", () => {
    // Generate far up — many chunks. The retained tail must stay capped, not grow forever.
    for (let target = 500; target <= 12000; target += 500) {
      useWorldStore.getState().ensureHeight(target);
    }
    const { trampolines, highestY } = useWorldStore.getState();
    expect(highestY).toBeGreaterThan(11000); // generation kept advancing
    expect(trampolines.length).toBeLessThanOrEqual(400); // bounded
    // The retained pads are the high ones (the tail), strictly increasing by id.
    for (let i = 1; i < trampolines.length; i++) {
      expect(trampolines[i].id).toBeGreaterThan(trampolines[i - 1].id);
    }
  });
});
