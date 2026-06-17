import { afterEach, describe, expect, it } from "vitest";
import {
  getRouteProofTarget,
  isRouteProofSequenceActive,
  setRouteProofSequenceActive,
  setRouteProofTarget,
} from "../routeProofBridge";

afterEach(() => {
  setRouteProofTarget(null);
  setRouteProofSequenceActive(false);
});

describe("route proof bridge", () => {
  it("tracks the active proof target and dev sequence lock independently", () => {
    expect(getRouteProofTarget()).toBeNull();
    expect(isRouteProofSequenceActive()).toBe(false);

    setRouteProofTarget({ pairIndex: 4 });
    setRouteProofSequenceActive(true);

    expect(getRouteProofTarget()).toEqual({ pairIndex: 4 });
    expect(isRouteProofSequenceActive()).toBe(true);

    setRouteProofTarget(null);
    setRouteProofSequenceActive(false);

    expect(getRouteProofTarget()).toBeNull();
    expect(isRouteProofSequenceActive()).toBe(false);
  });
});
