import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock motion's animate so the test asserts the trigger contract without a real DOM
// animation (motion's DOM keyframe measurement needs real layout, absent in happy-dom).
const animate = vi.fn();
vi.mock("motion", () => ({ animate: (...args: unknown[]) => animate(...args) }));

import { usePunchOnChange } from "../usePunchOnChange";

describe("usePunchOnChange", () => {
  beforeEach(() => animate.mockClear());
  afterEach(() => vi.clearAllMocks());

  it("returns a ref and does NOT punch on first render", () => {
    const { result } = renderHook(() => usePunchOnChange<HTMLDivElement>(0));
    expect(result.current).toHaveProperty("current");
    expect(animate).not.toHaveBeenCalled();
  });

  it("punches once each time the value changes (with an attached element)", () => {
    const el = document.createElement("div");
    const { result, rerender } = renderHook(({ v }) => usePunchOnChange<HTMLDivElement>(v), {
      initialProps: { v: 0 },
    });
    // Attach an element so the effect has a target.
    result.current.current = el;

    rerender({ v: 1 });
    expect(animate).toHaveBeenCalledTimes(1);
    expect(animate.mock.calls[0][0]).toBe(el);

    rerender({ v: 2 });
    expect(animate).toHaveBeenCalledTimes(2);
  });

  it("does nothing when the value is unchanged across renders", () => {
    const el = document.createElement("div");
    const { result, rerender } = renderHook(({ v }) => usePunchOnChange<HTMLDivElement>(v), {
      initialProps: { v: 5 },
    });
    result.current.current = el;
    rerender({ v: 5 });
    expect(animate).not.toHaveBeenCalled();
  });

  it("no-ops safely when no element is attached", () => {
    const { rerender } = renderHook(({ v }) => usePunchOnChange<HTMLDivElement>(v), {
      initialProps: { v: 0 },
    });
    expect(() => rerender({ v: 1 })).not.toThrow();
    expect(animate).not.toHaveBeenCalled();
  });
});
