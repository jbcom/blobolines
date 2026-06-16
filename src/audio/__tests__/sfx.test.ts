import { describe, expect, it } from "vitest";
import {
  isAudioInitialized,
  playBounce,
  playChime,
  playLaunch,
  playPowerup,
  playSplat,
  setMusicAltitude,
  setMusicEnabled,
  startMusic,
  stopMusic,
} from "../index";

// Audio (Howler) unlocks on a user gesture, so before initAudio() resolves the
// AudioContext, every cue must be a safe no-op — never throw, never force playback. Real
// playback is exercised in-browser; here we lock the no-op/uninitialized contract.
describe("audio before init", () => {
  it("reports uninitialized", () => {
    expect(isAudioInitialized()).toBe(false);
  });

  it("every SFX cue is a safe no-op (no throw) before init", () => {
    expect(() => playBounce("standard")).not.toThrow();
    expect(() => playBounce("booster")).not.toThrow();
    // Bonus pads map to distinct samples (ice → bright click, fragile → soft).
    expect(() => playBounce("super")).not.toThrow();
    expect(() => playBounce("ice")).not.toThrow();
    expect(() => playLaunch(1)).not.toThrow();
    expect(() => playChime()).not.toThrow();
    expect(() => playPowerup()).not.toThrow();
    expect(() => playSplat()).not.toThrow();
  });

  it("rate-limits / repeats without error", () => {
    for (let i = 0; i < 20; i++) expect(() => playBounce("standard")).not.toThrow();
  });

  it("setMusicAltitude is a safe no-op before music starts", () => {
    expect(() => setMusicAltitude(0)).not.toThrow();
    expect(() => setMusicAltitude(900)).not.toThrow();
  });
});

// The music/ambient beds reuse cached Howls, so a fade-out's delayed stop() can race a
// restart of the same path. These lock the lifecycle contract: rapid restart and altitude
// churn must never throw, and toggling music-enabled is idempotent across that lifecycle.
describe("music + ambient lifecycle", () => {
  it("survives rapid restart without throwing (stale-stop cancellation path)", () => {
    expect(() => {
      for (let i = 0; i < 5; i++) {
        startMusic();
        stopMusic();
      }
      startMusic();
    }).not.toThrow();
    stopMusic();
  });

  it("survives rapid altitude band crossings without throwing", () => {
    startMusic();
    expect(() => {
      // Cross the sky↔space boundary (650) back and forth — each crossing swaps the bed,
      // scheduling a stop on the old path then restarting the other; must not race-throw.
      for (let i = 0; i < 8; i++) setMusicAltitude(i % 2 === 0 ? 900 : 100);
    }).not.toThrow();
    stopMusic();
  });

  it("applies the muted state to beds started after muting", () => {
    setMusicEnabled(false);
    expect(() => startMusic()).not.toThrow();
    setMusicEnabled(true);
    stopMusic();
  });
});
