import { beforeEach, describe, expect, it } from "vitest";
import { routeProfile } from "@/world";
import { useWorldStore } from "../worldStore";

function lateralGap(a: readonly [number, number, number], b: readonly [number, number, number]) {
  return Math.hypot(b[0] - a[0], b[2] - a[2]);
}

describe("worldStore.reset seeding", () => {
  it("uses an explicit seed when given (reproducible / daily run)", () => {
    useWorldStore.getState().reset(42);
    expect(useWorldStore.getState().seed).toBe(42);
    expect(useWorldStore.getState().seedPhrase).toBe("seed-16");
  });

  it("uses the selected difficulty when resetting a tower", () => {
    useWorldStore.getState().reset(42, "blobmare");
    expect(useWorldStore.getState().difficulty).toBe("blobmare");
    useWorldStore.getState().reset(43);
    expect(useWorldStore.getState().difficulty).toBe("blobmare");
  });

  it("replays an explicit phrase seed", () => {
    useWorldStore.getState().reset("bouncy-bright-blob", "ready");
    const first = useWorldStore.getState();
    const firstPads = first.trampolines.map((pad) => pad.position);
    useWorldStore.getState().reset("bouncy-bright-blob", "ready");
    expect(useWorldStore.getState().seedPhrase).toBe("bouncy-bright-blob");
    expect(useWorldStore.getState().seed).toBe(first.seed);
    expect(useWorldStore.getState().trampolines.map((pad) => pad.position)).toEqual(firstPads);
  });

  it("creates a fresh visible phrase when none is given", () => {
    useWorldStore.getState().reset(1);
    useWorldStore.getState().reset(); // derive from prev seed
    const phrase = useWorldStore.getState().seedPhrase;
    expect(phrase).toMatch(/^[a-z]+-[a-z]+-[a-z]+$/);
    expect(phrase).not.toBe("seed-1");
  });

  it("increments run id even when replaying the same seed", () => {
    useWorldStore.getState().reset("bouncy-bright-blob");
    const runId = useWorldStore.getState().runId;
    useWorldStore.getState().reset("bouncy-bright-blob");
    expect(useWorldStore.getState().runId).toBe(runId + 1);
  });

  it("starts a fresh run with a visible successor pad from the starter", () => {
    for (let seed = 1; seed <= 10; seed++) {
      useWorldStore.getState().reset(seed, "ready");
      const [starter, next] = useWorldStore.getState().trampolines;
      expect(starter.position).toEqual([0, 0, 0]);
      expect(next).toBeDefined();
      expect(["flat", "moving", "canted", "wobbler"]).toContain(starter.goldenPath?.sourceMode);
      expect(starter.goldenPath?.toPadId).toBe(next.id);
      expect(starter.goldenPath?.variants?.length).toBe(routeProfile("ready").proofVariants);
      const dy = next.position[1] - starter.position[1];
      const lateral = lateralGap(starter.position, next.position);
      expect(dy).toBeLessThanOrEqual(7.2);
      expect(lateral).toBeGreaterThanOrEqual(10.5);
      expect(lateral).toBeLessThanOrEqual(14.25);
    }
  });
});

describe("worldStore.ensureHeight", () => {
  beforeEach(() => useWorldStore.getState().reset(1, "ready"));

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

  it("leaves no padless gap above DEATH_FALL_DISTANCE below any teleport target", () => {
    // Regression: sequential dev teleports all collapsed to ~60 because the FIRST teleport
    // pushed highestY high, so later ensureHeight(target+40) calls for lower bands hit the
    // monotonic `targetY <= highestY` short-circuit and added no pads — the body free-dropped
    // from the target past DEATH_FALL_DISTANCE (24) and died before touching anything. The
    // tower IS generated continuously from 0 to highestY though, so for ANY target there must
    // be a real pad within DEATH_FALL_DISTANCE below it. PlayerBlob's teleport snap relies on
    // exactly this: it places the body on the nearest pad at-or-below the target.
    const DEATH_FALL_DISTANCE = 24;
    // First teleport to a high band — this is what sets highestY high in the failing scenario.
    useWorldStore.getState().ensureHeight(600 + 40);
    const pads = useWorldStore
      .getState()
      .trampolines.map((p) => p.position[1])
      .sort((a, b) => a - b);
    // Every sequential target the bug hit must have a pad within DEATH_FALL_DISTANCE below it.
    for (const target of [120, 320, 600, 900, 1400].filter((t) => t <= 640)) {
      const below = pads.filter((y) => y <= target);
      expect(below.length).toBeGreaterThan(0);
      const nearest = below[below.length - 1];
      expect(target - nearest).toBeLessThan(DEATH_FALL_DISTANCE);
    }
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
