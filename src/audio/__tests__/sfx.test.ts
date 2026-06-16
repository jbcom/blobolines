import { describe, expect, it } from "vitest";
import {
  isAudioInitialized,
  playBounce,
  playChime,
  playLaunch,
  playPowerup,
  playSplat,
} from "../index";

// Audio is gated on a user gesture (Tone.start), so before initAudio() everything must
// be a safe no-op — never throw, never create an AudioContext. Real audio-graph wiring
// is exercised in the browser test env; here we lock the no-op contract.
describe("sfx before init", () => {
  it("reports uninitialized", () => {
    expect(isAudioInitialized()).toBe(false);
  });

  it("every SFX is a safe no-op (no throw) before init", () => {
    expect(() => playBounce("standard")).not.toThrow();
    expect(() => playBounce("booster")).not.toThrow();
    expect(() => playLaunch(1)).not.toThrow();
    expect(() => playChime()).not.toThrow();
    expect(() => playPowerup()).not.toThrow();
    expect(() => playSplat()).not.toThrow();
  });

  it("rate-limits repeated calls without error", () => {
    for (let i = 0; i < 20; i++) expect(() => playBounce("standard", 1000)).not.toThrow();
  });
});
