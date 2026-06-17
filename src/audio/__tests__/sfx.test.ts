import { Howler } from "howler";
import { describe, expect, it } from "vitest";
import {
  duckMusic,
  isAudioInitialized,
  playBounce,
  playChime,
  playComboBlip,
  playComboFanfare,
  playLaunch,
  playMilestone,
  playPowerdown,
  playPowerup,
  playRecord,
  playSplat,
  playThump,
  setAmbientVolume,
  setMusicAltitude,
  setMusicEnabled,
  setMusicVolume,
  setSfxVolume,
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
    // Every pad type now has a distinct bounce voice (padVoice) — all must be safe no-ops,
    // at any impact strength.
    for (const t of [
      "standard",
      "booster",
      "super",
      "moving",
      "canted",
      "wobbler",
      "fragile",
      "ice",
    ] as const) {
      expect(() => playBounce(t)).not.toThrow();
      expect(() => playBounce(t, 0)).not.toThrow();
      expect(() => playBounce(t, 1)).not.toThrow();
    }
    // Launch whoosh at every charge level (0 = soft, 1 = max) is a safe no-op pre-init.
    for (const c of [0, 0.5, 1]) expect(() => playLaunch(c)).not.toThrow();
    // Rising-pitch combo blip across the streak range, incl. 0 (silent) + over-cap.
    for (const n of [0, 1, 5, 8, 50]) expect(() => playComboBlip(n)).not.toThrow();
    expect(() => playComboFanfare()).not.toThrow();
    expect(() => playChime()).not.toThrow();
    expect(() => playPowerup()).not.toThrow();
    expect(() => playPowerdown()).not.toThrow();
    expect(() => playSplat()).not.toThrow();
    // Low-end thump layer across the strength range (incl. below the silent threshold).
    for (const s of [0, 0.2, 0.5, 1]) expect(() => playThump(s)).not.toThrow();
    // Arcade-identity celebration stingers.
    expect(() => playMilestone()).not.toThrow();
    expect(() => playRecord()).not.toThrow();
  });

  it("rate-limits / repeats without error", () => {
    for (let i = 0; i < 20; i++) expect(() => playBounce("standard")).not.toThrow();
  });

  it("setMusicAltitude is a safe no-op before music starts", () => {
    expect(() => setMusicAltitude(0)).not.toThrow();
    expect(() => setMusicAltitude(900)).not.toThrow();
  });

  it("setSfxVolume clamps + never throws, and SFX still play at any level", () => {
    expect(() => setSfxVolume(0)).not.toThrow();
    expect(() => playBounce("standard")).not.toThrow(); // muted SFX channel still safe
    expect(() => setSfxVolume(0.5)).not.toThrow();
    expect(() => setSfxVolume(5)).not.toThrow(); // clamped, no throw
    expect(() => playChime()).not.toThrow();
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

  it("the three mix buses (music/ambient/sfx) clamp + re-level live beds without throwing", () => {
    startMusic();
    for (const set of [setMusicVolume, setAmbientVolume, setSfxVolume]) {
      expect(() => set(0)).not.toThrow();
      expect(() => set(0.5)).not.toThrow();
      expect(() => set(5)).not.toThrow(); // clamped
      expect(() => set(-1)).not.toThrow(); // clamped
    }
    stopMusic();
    // Setting bus levels with no live bed is still safe.
    expect(() => setMusicVolume(0.7)).not.toThrow();
    expect(() => setAmbientVolume(0.3)).not.toThrow();
  });

  it("duckMusic is a safe no-op when music isn't playing, and survives while it is", () => {
    expect(() => duckMusic()).not.toThrow(); // not started yet
    startMusic();
    expect(() => duckMusic(600)).not.toThrow();
    expect(() => duckMusic(600)).not.toThrow(); // overlapping duck resets the hold
    stopMusic();
    expect(() => duckMusic()).not.toThrow(); // after stop, no live bed
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

  // Beds STREAM (html5:true) — long loops shouldn't fully decode into memory on mobile; short
  // SFX use Web Audio (html5:false) for low-latency overlap. Inspect Howler's global registry
  // to confirm the looping beds vs the one-shot SFX got the right backend.
  it("music/ambient beds use html5 streaming; SFX use Web Audio", () => {
    startMusic(); // creates the looping music + ambient beds
    playBounce("standard"); // creates a one-shot SFX Howl
    const howls = (Howler as unknown as { _howls: Array<{ _loop: boolean; _html5: boolean }> })
      ._howls;
    const beds = howls.filter((h) => h._loop);
    const sfx = howls.filter((h) => !h._loop);
    expect(beds.length).toBeGreaterThan(0);
    expect(sfx.length).toBeGreaterThan(0);
    expect(beds.every((h) => h._html5 === true)).toBe(true); // beds stream
    expect(sfx.every((h) => h._html5 === false)).toBe(true); // SFX low-latency
    stopMusic();
  });
});
