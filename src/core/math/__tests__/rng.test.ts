import { describe, expect, it } from "vitest";
import {
  canonicalSeedPhrase,
  createRng,
  createSeedPhrase,
  normalizeSeed,
  numericSeedPhrase,
} from "../rng";

describe("createRng", () => {
  it("is deterministic for the same seed", () => {
    const a = createRng(1234);
    const b = createRng(1234);
    const seqA = Array.from({ length: 10 }, () => a.next());
    const seqB = Array.from({ length: 10 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it("differs across seeds", () => {
    const a = createRng(1);
    const b = createRng(2);
    expect(a.next()).not.toBe(b.next());
  });

  it("accepts string seed phrases via seedrandom", () => {
    const a = createRng("blobolines");
    const b = createRng("blobolines");
    expect(a.next()).toBe(b.next());
    expect(createRng("blob").next()).not.toBe(createRng("lines").next());
  });

  it("produces floats in [0,1)", () => {
    const r = createRng(99);
    for (let i = 0; i < 1000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("int() stays within inclusive bounds", () => {
    const r = createRng(7);
    for (let i = 0; i < 1000; i++) {
      const v = r.int(3, 9);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(9);
      expect(Number.isInteger(v)).toBe(true);
    }
  });

  it("range() stays within [min,max)", () => {
    const r = createRng(11);
    for (let i = 0; i < 1000; i++) {
      const v = r.range(-2, 5);
      expect(v).toBeGreaterThanOrEqual(-2);
      expect(v).toBeLessThan(5);
    }
  });

  it("pick() returns a member and sign() returns ±1", () => {
    const r = createRng(5);
    const items = ["a", "b", "c"] as const;
    for (let i = 0; i < 100; i++) {
      expect(items).toContain(r.pick(items));
      expect([1, -1]).toContain(r.sign());
    }
  });

  it("reset() replays the original stream", () => {
    const r = createRng(42);
    const first = [r.next(), r.next(), r.next()];
    r.reset();
    expect([r.next(), r.next(), r.next()]).toEqual(first);
  });

  it("pick() throws on an empty array (non-empty contract)", () => {
    expect(() => createRng(1).pick([])).toThrow();
  });

  it("range() and int() throw on inverted bounds", () => {
    const r = createRng(1);
    expect(() => r.range(5, 1)).toThrow();
    expect(() => r.int(9, 2)).toThrow();
  });

  it("normalizeSeed yields an unsigned 32-bit int", () => {
    expect(normalizeSeed(-1)).toBe(0xffffffff);
    expect(normalizeSeed(numericSeedPhrase(42))).toBe(42);
    expect(normalizeSeed("x")).toBeGreaterThanOrEqual(0);
    expect(normalizeSeed("x")).toBeLessThanOrEqual(0xffffffff);
  });

  it("canonicalizes free-form seed text", () => {
    expect(canonicalSeedPhrase("  Bouncy Bright Blob!! ")).toBe("bouncy-bright-blob");
    expect(canonicalSeedPhrase("")).toBe("seed-empty");
  });

  it("creates deterministic adjective-adjective-noun phrases from explicit entropy", () => {
    const a = createSeedPhrase("menu-open-1");
    const b = createSeedPhrase("menu-open-1");
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-z]+-[a-z]+-[a-z]+$/);
    expect(createSeedPhrase("menu-open-2")).not.toBe(a);
  });

  it("exposes the canonical phrase on streams", () => {
    const r = createRng("Bouncy Bright Blob");
    expect(r.phrase).toBe("bouncy-bright-blob");
  });
});
