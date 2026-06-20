import { afterEach, describe, expect, it } from "vitest";
import {
  isCrystalCollected,
  markCrystalCollected,
  resetCollectedCrystals,
} from "../crystalCollectBridge";

afterEach(() => resetCollectedCrystals());

describe("crystal collect bridge", () => {
  it("reports a crystal as not collected until marked", () => {
    expect(isCrystalCollected(3)).toBe(false);
    markCrystalCollected(3);
    expect(isCrystalCollected(3)).toBe(true);
  });

  it("tracks collected indices independently", () => {
    markCrystalCollected(1);
    markCrystalCollected(5);
    expect(isCrystalCollected(1)).toBe(true);
    expect(isCrystalCollected(5)).toBe(true);
    expect(isCrystalCollected(2)).toBe(false);
  });

  it("resetCollectedCrystals clears everything for a fresh run", () => {
    markCrystalCollected(0);
    markCrystalCollected(9);
    resetCollectedCrystals();
    expect(isCrystalCollected(0)).toBe(false);
    expect(isCrystalCollected(9)).toBe(false);
  });
});
