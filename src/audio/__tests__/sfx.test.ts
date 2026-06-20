import { Howler } from "howler";
import { describe, expect, it } from "vitest";
import {
  duckMusic,
  isAudioInitialized,
  MILESTONE_TIER_COUNT,
  milestoneTierFor,
  milestoneTierIndex,
  pauseMusic,
  playBounce,
  playChime,
  playComboBlip,
  playComboFanfare,
  playDeath,
  playLaunch,
  playMilestone,
  playPowerdown,
  playPowerup,
  playRecord,
  playSplat,
  playThump,
  playUi,
  preloadSfx,
  resumeMusic,
  setAmbientVolume,
  setMusicAltitude,
  setMusicEnabled,
  setMusicVolume,
  setSfxVolume,
  startMenuMusic,
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
    // Death sting + UI interface cues are safe no-ops pre-init too.
    expect(() => playDeath()).not.toThrow();
    for (const id of ["hover", "click", "confirm", "cancel", "popup", "coin"] as const) {
      expect(() => playUi(id)).not.toThrow();
    }
  });

  it("rate-limits / repeats without error", () => {
    for (let i = 0; i < 20; i++) expect(() => playBounce("standard")).not.toThrow();
  });

  it("setMusicAltitude is a safe no-op before music starts", () => {
    expect(() => setMusicAltitude(0)).not.toThrow();
    expect(() => setMusicAltitude(900)).not.toThrow();
  });

  it("preloadSfx constructs every SFX Howl (no-throw, idempotent, none playing)", () => {
    expect(() => preloadSfx()).not.toThrow();
    const after = (Howler as unknown as { _howls: Array<{ _loop: boolean; playing(): boolean }> })
      ._howls;
    const sfx = after.filter((h) => !h._loop);
    // All the one-shot SFX are now constructed (cached) — preload built the full set.
    expect(sfx.length).toBeGreaterThanOrEqual(8);
    // Preloading must not start playback (it only loads/decodes).
    expect(sfx.every((h) => !h.playing())).toBe(true);
    // Idempotent — a second call doesn't throw or duplicate beyond the cache.
    const count = after.length;
    preloadSfx();
    expect(after.length).toBe(count);
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

  it("a replay on the SAME band restarts the ground track (stopMusic resets musicKey)", () => {
    const liveTrack = () => {
      const hs = (Howler as unknown as { _howls: Array<{ _loop: boolean; _src: string[] }> })
        ._howls;
      return hs
        .filter((h) => h._loop)
        .flatMap((h) => h._src)
        .join(" ");
    };
    // play → menu → play, never leaving the ground band: the second climb must NOT start silent
    // (regression: if stopMusic left musicKey="ground", setMusicBand("ground") would no-op).
    startMusic();
    expect(liveTrack()).toContain("music/biomes/ground.mp3");
    stopMusic();
    startMusic();
    expect(liveTrack(), "the ground track must restart on a same-band replay").toContain(
      "music/biomes/ground.mp3",
    );
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

  it("pause/resumeMusic hold an indefinite duck and restore it without throwing", () => {
    // The live looping music bed, if any.
    const liveBed = () => {
      const hs = (
        Howler as unknown as { _howls: Array<{ _loop: boolean; volume(): number }> }
      )._howls;
      return hs.find((h) => h._loop);
    };

    expect(() => pauseMusic()).not.toThrow(); // no live bed yet → no-op
    expect(() => resumeMusic()).not.toThrow(); // not paused → no-op

    startMusic();
    const bed = liveBed();
    expect(bed, "music bed is live after startMusic").toBeTruthy();

    // Pause holds the bed ducked (fades toward 25% of target); resume lifts it. Both must be safe,
    // and resume must clear the paused flag so a subsequent pause works again (no stuck-duck).
    expect(() => pauseMusic()).not.toThrow();
    expect(() => pauseMusic()).not.toThrow(); // idempotent re-pause
    expect(() => resumeMusic()).not.toThrow();
    expect(() => resumeMusic()).not.toThrow(); // idempotent re-resume (flag cleared → no-op)

    // A timed duck started DURING a pause must not auto-restore the bed while still paused: the
    // unduck timer bails on the musicPaused flag. Exercise that interleaving for no-throw.
    pauseMusic();
    duckMusic(50);
    expect(() => resumeMusic()).not.toThrow();

    stopMusic();
    // After stop the paused flag is irrelevant; resume is a safe no-op.
    expect(() => resumeMusic()).not.toThrow();
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

  it("menu music is a true no-op before audio unlock", () => {
    const loopPaths = () => {
      const hs = (Howler as unknown as { _howls: Array<{ _loop: boolean; _src: string[] }> })
        ._howls;
      return hs
        .filter((h) => h._loop)
        .flatMap((h) => h._src)
        .join(" ");
    };
    const before = loopPaths();
    startMenuMusic();
    expect(loopPaths()).toBe(before);
  });

  it("per-band music: the in-game track + ambient bed both follow the biome bands by altitude", () => {
    const loopPaths = () => {
      const hs = (Howler as unknown as { _howls: Array<{ _loop: boolean; _src: string[] }> })
        ._howls;
      return hs
        .filter((h) => h._loop)
        .flatMap((h) => h._src)
        .join(" ");
    };
    startMusic(); // PLAY → ground band track + ground ambient
    setMusicAltitude(50); // still the ground band
    const low = loopPaths();
    expect(low).toContain("music/biomes/ground.mp3"); // ground band's own track
    expect(low).toContain("ambient/forest.mp3"); // ground ambient bed
    setMusicAltitude(1000); // deep into the upper bands → space band
    const high = loopPaths();
    expect(high).toContain("music/biomes/space.mp3"); // music followed the band
    expect(high).toContain("ambient/space.mp3"); // ambient bed followed too
    // (the ground track + bed linger briefly here while they CROSSFADE out — that's expected;
    //  the meaningful assertion is that the new band's track took over.)
    stopMusic();
  });

  it("setMusicAltitude is a FULL no-op on the menu (starts no new music/ambient bed)", () => {
    const liveLoops = () => {
      const hs = (Howler as unknown as { _howls: Array<{ _loop: boolean; playing(): boolean }> })
        ._howls;
      return hs.filter((h) => h._loop && h.playing()).length;
    };
    startMenuMusic(); // music-only menu (musicKey === "menu")
    const before = liveLoops();
    // A stray altitude tick while on the menu must start NOTHING — neither a band music track nor
    // an ambient bed (the menu is deliberately music-only). The live-loop count must not grow.
    setMusicAltitude(900);
    expect(liveLoops(), "menu altitude tick must not start any new bed").toBeLessThanOrEqual(
      before,
    );
    stopMusic();
  });

  it("ambient bed follows ALL 6 canonical biome bands without throwing", () => {
    const loopPaths = () => {
      const hs = (Howler as unknown as { _howls: Array<{ _loop: boolean; _src: string[] }> })
        ._howls;
      return hs
        .filter((h) => h._loop)
        .flatMap((h) => h._src)
        .join(" ");
    };
    startMusic();
    // A representative altitude inside each canonical band (ground/sky/upper-atmosphere/
    // stratosphere/space/deep-space). Every band must map to a bed — setAmbientBand throws
    // on an unmapped band, so reaching all of them without throwing proves full coverage.
    const bandAltitudes = [10, 150, 400, 700, 1000, 1500];
    expect(() => {
      for (const y of bandAltitudes) setMusicAltitude(y);
    }).not.toThrow();
    // Deep-space shares the space bed; confirm the cosmic bed is live up high.
    setMusicAltitude(1500);
    expect(loopPaths()).toContain("space.mp3");
    // Returning to the ground band swaps back to the warm forest bed.
    setMusicAltitude(0);
    expect(loopPaths()).toContain("forest.mp3");
    stopMusic();
  });

  it("does not spawn a duplicate ambient loop when adjacent bands share a bed", () => {
    // sky and upper-atmosphere both map to wind.mp3 — crossing between them must keep the SAME
    // single loop, not stop+restart (or double-play) the shared bed. Count actively-PLAYING
    // wind sounds (a double-play would leave two playing at once) rather than cached instances.
    const windPlaying = () => {
      const hs = (
        Howler as unknown as {
          _howls: Array<{ _loop: boolean; _src: string[]; playing(): boolean }>;
        }
      )._howls;
      return hs.filter((h) => h._loop && h._src.some((s) => s.includes("wind.mp3")) && h.playing())
        .length;
    };
    startMusic();
    setMusicAltitude(150); // sky → wind bed
    const afterSky = windPlaying();
    setMusicAltitude(400); // upper-atmosphere → same wind bed (must not start a 2nd loop)
    setMusicAltitude(150); // back to sky → still the same wind bed
    // No additional wind loop began playing across the shared-bed crossings.
    expect(windPlaying()).toBeLessThanOrEqual(afterSky);
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

// The milestone stinger escalates with altitude — a higher climb earns a grander fanfare. The tier
// resolver is pure (config-driven thresholds), so we lock its boundaries directly.
describe("milestone stinger tiers", () => {
  it("escalates the stinger by altitude tier (bright → triumph → epic → mega)", () => {
    expect(milestoneTierFor(100)).toBe("milestone-tier1"); // first altitude milestone
    expect(milestoneTierFor(400)).toBe("milestone-tier1"); // still tier 1 below 500
    expect(milestoneTierFor(500)).toBe("milestone-tier2"); // boundary → tier 2
    expect(milestoneTierFor(999)).toBe("milestone-tier2");
    expect(milestoneTierFor(1000)).toBe("milestone-tier3"); // boundary → tier 3
    expect(milestoneTierFor(2000)).toBe("milestone-tier4"); // boundary → top tier
    expect(milestoneTierFor(99999)).toBe("milestone-tier4"); // very high stays top tier
  });

  it("falls to the lowest tier below the first threshold (and at 0)", () => {
    expect(milestoneTierFor(0)).toBe("milestone-tier1");
    expect(milestoneTierFor(-50)).toBe("milestone-tier1"); // defensive: never undefined
  });

  it("playMilestone(height) is a safe no-op across every tier pre-init", () => {
    for (const h of [0, 100, 500, 1000, 2000, 5000]) {
      expect(() => playMilestone(h)).not.toThrow();
    }
    expect(() => playMilestone()).not.toThrow(); // no-arg → lowest tier
  });

  it("milestoneTierIndex is the SHARED 0-based tier source (audio + visual key off it)", () => {
    // The index escalates 0→last and aligns with the sfx tiers (the visual banner uses this index).
    expect(milestoneTierIndex(0)).toBe(0);
    expect(milestoneTierIndex(100)).toBe(0);
    expect(milestoneTierIndex(500)).toBe(1);
    expect(milestoneTierIndex(1000)).toBe(2);
    expect(milestoneTierIndex(2000)).toBe(3);
    expect(milestoneTierIndex(99999)).toBe(MILESTONE_TIER_COUNT - 1); // caps at the top tier
    expect(milestoneTierIndex(-50)).toBe(0); // floor
  });

  it("milestoneTierFor is exactly the sfx of milestoneTierIndex's tier (no separate threshold list)", () => {
    for (const h of [0, 250, 500, 1200, 2500]) {
      expect(milestoneTierFor(h)).toBe(`milestone-tier${milestoneTierIndex(h) + 1}`);
    }
  });
});
