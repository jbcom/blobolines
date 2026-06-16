import { describe, expect, it, vi } from "vitest";
import { createSplatCanvas, toTransparent } from "../splat";

describe("toTransparent", () => {
  it("keeps the rgb of a #rrggbb color and forces alpha 0 (not black)", () => {
    // The dark-ring bug: the old code used the CSS keyword "transparent" as the
    // outer gradient stop, which is rgba(0,0,0,0). Canvas lerps rgb across stops,
    // so edge texels went dark-blue -> black. The transparent stop MUST carry the
    // blob's own rgb so the fade stays the blob color all the way to a=0.
    expect(toTransparent("#2e8bf0")).toBe("rgba(46,139,240,0)");
    expect(toTransparent("#2e8bf0")).not.toBe("rgba(0,0,0,0)");
  });

  it("supports #rgb shorthand", () => {
    expect(toTransparent("#0af")).toBe("rgba(0,170,255,0)");
  });

  it("supports #rrggbbaa by dropping the alpha to 0", () => {
    expect(toTransparent("#2e8bf080")).toBe("rgba(46,139,240,0)");
  });

  it("supports rgb()/rgba() inputs", () => {
    expect(toTransparent("rgb(46, 139, 240)")).toBe("rgba(46,139,240,0)");
    expect(toTransparent("rgba(46, 139, 240, 0.5)")).toBe("rgba(46,139,240,0)");
  });
});

describe("createSplatCanvas paint gradient stops", () => {
  it("never uses the bare 'transparent' keyword as a gradient stop", () => {
    // Regression: bare "transparent" = rgba(0,0,0,0) -> dark edge rings.
    // happy-dom has no real Canvas2D backend, so stub a minimal context that
    // records the gradient stops the painter requests.
    const recorded: Array<[number, string]> = [];
    const fakeGradient = {
      addColorStop: (offset: number, color: string) => {
        recorded.push([offset, color]);
      },
    };
    const fakeCtx = {
      createRadialGradient: () => fakeGradient,
      beginPath: () => {},
      arc: () => {},
      fill: () => {},
      fillRect: () => {},
      set fillStyle(_v: unknown) {},
      set globalCompositeOperation(_v: unknown) {},
    };
    const getContext = vi
      .spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockReturnValue(fakeCtx as unknown as CanvasRenderingContext2D);

    const sc = createSplatCanvas(64);
    sc.paint(0.5, 0.5, "#2e8bf0", 0.2);
    getContext.mockRestore();

    expect(recorded.length).toBeGreaterThan(0);
    // The outer (offset 1) stop must be a same-rgb transparent, never "transparent"
    // and never an rgba with black rgb.
    const outerStops = recorded.filter(([offset]) => offset === 1);
    expect(outerStops.length).toBeGreaterThan(0);
    for (const [, color] of outerStops) {
      expect(color).not.toBe("transparent");
      expect(color).toBe("rgba(46,139,240,0)");
    }
  });
});
