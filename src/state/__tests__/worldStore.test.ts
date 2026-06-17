import { beforeEach, describe, expect, it } from "vitest";
import { useWorldStore } from "../worldStore";

function lateralGap(a: readonly [number, number, number], b: readonly [number, number, number]) {
  return Math.hypot(b[0] - a[0], b[2] - a[2]);
}

describe("worldStore.reset seeding", () => {
  it("uses an explicit seed when given (reproducible / daily run)", () => {
    useWorldStore.getState().reset(42);
    expect(useWorldStore.getState().seed).toBe(42);
  });

  it("advances the seed deterministically when none is given (no performance.now)", () => {
    useWorldStore.getState().reset(1);
    useWorldStore.getState().reset(); // derive from prev seed
    const a = useWorldStore.getState().seed;
    useWorldStore.getState().reset(1);
    useWorldStore.getState().reset(); // same prior → same next
    expect(useWorldStore.getState().seed).toBe(a);
    expect(a).not.toBe(1);
  });

  it("starts a fresh run with a visible successor pad from the starter", () => {
    for (let seed = 1; seed <= 10; seed++) {
      useWorldStore.getState().reset(seed);
      const [starter, next] = useWorldStore.getState().trampolines;
      expect(starter.position).toEqual([0, 0, 0]);
      expect(next).toBeDefined();
      const dy = next.position[1] - starter.position[1];
      const lateral = lateralGap(starter.position, next.position);
      expect(dy).toBeLessThanOrEqual(9.35);
      expect(lateral).toBeGreaterThanOrEqual(3.55);
      expect(lateral).toBeLessThanOrEqual(4.85);
    }
  });
});

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
