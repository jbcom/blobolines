# `src/audio` — Howler.js sample playback

All sound. Plays the real itch.io sample library (owned packs) via **Howler.js** —
replaced the earlier procedural Tone.js synthesis. Cue → file mappings, themes, and
volumes are data in [`src/config/audio.json`](../config/audio.json); the samples live in
`public/assets/audio/` (`sfx/`, `music/`, `ambient/`).

## Files

| File | Owns |
|------|------|
| `howler.ts` | The engine: lazy per-path `Howl` cache, three channels (music loop, altitude-swapped ambient bed, fire-and-forget SFX), gesture unlock, master volume + mute. Paths resolve under `import.meta.env.BASE_URL` (correct on Pages + Capacitor). |
| `index.ts` | Public cue surface re-exported from the engine. |

## API

- `initAudio()` — resume the AudioContext from a user gesture (the PLAY click).
- `playBounce(type)` / `playLaunch()` / `playSplat()` / `playChime()` / `playPowerup()`
  — fire-and-forget cues (per-pad bounce sample; ice → bright click, fragile → soft).
- `startMusic()` / `stopMusic()` — fade the looping theme + ambient bed in/out.
- `setMusicAltitude(height)` — swap the ambient bed (sky → space) as the blob climbs.
- `setMasterVolume(v)` / `setMusicEnabled(on)` — settings, mapped onto Howler.

## Rules

- **Gesture-gated**: cues are safe no-ops until `initAudio` resolves the context.
- **Lazy + cached**: a `Howl` is created on first use of a path and reused for the
  session; Howler overlaps SFX plays natively.
- **Add a sound = edit `audio.json`** (drop the file in `public/assets/audio/`), not code.

Tests (`__tests__/sfx.test.ts`) lock the before-init no-op contract.
