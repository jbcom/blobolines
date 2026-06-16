/**
 * Vitest setup for the happy-dom unit environment. Provides the browser globals that
 * R3F/three and game code expect but happy-dom does not implement (WebGL context,
 * rAF, ResizeObserver, matchMedia). Real WebGL rendering is exercised in the browser
 * config (vitest.browser.config.ts), not here.
 */
import { afterEach, vi } from "vitest";

// requestAnimationFrame / cancelAnimationFrame
if (!globalThis.requestAnimationFrame) {
  globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) =>
    setTimeout(
      () => cb(performance.now()),
      16,
    ) as unknown as number) as typeof requestAnimationFrame;
  globalThis.cancelAnimationFrame = ((id: number) =>
    clearTimeout(id as unknown as ReturnType<typeof setTimeout>)) as typeof cancelAnimationFrame;
}

// ResizeObserver
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

// matchMedia
if (!globalThis.matchMedia) {
  globalThis.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof matchMedia;
}

// Minimal WebGL stub so three.js can construct a renderer without a real GPU.
const canvasProto = globalThis.HTMLCanvasElement?.prototype;
if (canvasProto) {
  const original = canvasProto.getContext;
  canvasProto.getContext = function getContext(
    this: HTMLCanvasElement,
    type: string,
    ...rest: unknown[]
  ) {
    if (type === "webgl2" || type === "webgl" || type === "experimental-webgl") {
      // happy-dom has no WebGL; tests needing real GL run in the browser config.
      return null;
    }
    return original?.apply(this, [type, ...rest] as Parameters<typeof original>) ?? null;
  } as typeof canvasProto.getContext;
}

afterEach(() => {
  vi.clearAllTimers();
});
