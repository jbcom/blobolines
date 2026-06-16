# `src/audio` — Tone.js engine, SFX, and music

All sound. A lazily-initialized Tone.js engine with a gain-bus split (sfx / music),
procedural sound effects, and procedural ambient music. No samples — everything is
synthesized, so there are no audio assets to ship.

## Files

| File | Owns |
|------|------|
| `engine.ts` | Lazy `initAudio` (concurrency-safe via a shared init promise), the master + sfx + music gain buses, `setMasterVolume`/`setMusicEnabled`, `getTone`/`getSfxOutput`/`getMusicOutput`, `isAudioInitialized`. |
| `sfx.ts` | Procedural one-shots: `playBounce`/`playLaunch`/`playChime`/`playPowerup`/`playSplat`. No-op before `initAudio` resolves. |
| `music.ts` | Procedural ambient bed: `startMusic`/`stopMusic` (a pad drone + a `Tone.Loop` plucked sequence on the music bus). |

## Rules

- **The AudioContext can only start from a user gesture.** `initAudio` is called
  from the PLAY click; SFX/music are silent no-ops until it resolves, so it's safe
  to call play functions early.
- **`initAudio` is concurrency-safe** — multiple callers share one init promise; it
  never double-initializes the context.
- SFX route through the sfx bus, music through the music bus, both under master —
  so the settings (master volume, music toggle) map cleanly onto gain nodes.

Tests live in `__tests__/` and assert the play functions are safe no-ops before
init. See [`docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md).
