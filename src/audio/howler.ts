import { Howl, Howler } from "howler";
import audioCfg from "@/config/audio.json";
import { biomeBandAt } from "@/config/biomes";
import type { TrampType } from "@/core/types";
import { MAX_COMBO } from "@/sim/combo";
import { padVoice } from "./padVoice";
import { createPitchVariation } from "./variants";

/**
 * Howler-backed audio engine playing the real itch.io sample library (config/audio.json)
 * instead of procedural Tone.js synthesis. Three channels:
 *   - music: one looping theme, faded in on start, out on stop
 *   - ambient: an environmental bed swapped by altitude band (sky → space)
 *   - sfx: fire-and-forget cues (Howler overlaps plays natively)
 * Howls are created lazily per path and cached for the session. Paths resolve under the
 * Vite base URL so they're correct on Pages (/blobolines/) and Capacitor (./).
 */

type SfxId = keyof typeof audioCfg.sfx;

const url = (p: string) => `${import.meta.env.BASE_URL}${p}`;
const vol = audioCfg.volumes;

const howls = new Map<string, Howl>();
let music: Howl | null = null;
let ambient: Howl | null = null;
let ambientBand = "";
/** Current music track key ("menu" | "ingame" | "highspace"), so an altitude/phase change only
 *  crossfades when the target track actually differs. */
let musicKey = "";
let started = false;
let muted = false;
/** Independent mix-bus levels [0,1], each multiplied into its channel's play volume on top of
 *  the per-cue base (config) volume and the master (Howler.volume). The three buses — music,
 *  ambient, sfx — are settable independently so a player can e.g. keep SFX punchy but drop the
 *  music. (Master is Howler.volume via setMasterVolume.) */
let sfxVolume = 1;
let musicVolume = 1;
let ambientVolume = 1;

/** Target play volume for the music bed = config base × the music bus level. */
const musicTarget = () => vol.music * musicVolume;
/** Target play volume for the ambient bed = config base × the ambient bus level. */
const ambientTarget = () => vol.ambient * ambientVolume;

function howlFor(path: string, loop: boolean, volume: number, html5 = false): Howl {
  let h = howls.get(path);
  if (!h) {
    // html5:true STREAMS the file (HTML5 Audio) instead of fully decoding it into memory — the
    // right mode for the long music + ambient loops (lower memory + no big up-front decode on
    // mobile). Short SFX keep html5:false: Web Audio gives them low-latency, overlap-friendly
    // playback (an HTML5 element can't play the same sample twice at once).
    h = new Howl({ src: [url(path)], loop, volume, html5 });
    howls.set(path, h);
  }
  return h;
}

/** Pending fade-out-then-stop timers, keyed by audio path. Because Howls are cached and
 *  reused, a delayed stop() from a previous fade-out can land *after* the same path has
 *  been restarted (quick restart, rapid altitude crossings) and silence the live sound.
 *  Tracking per path lets us cancel a stale stop before replaying that path. */
const pendingStops = new Map<string, ReturnType<typeof setTimeout>>();

/** Fade `howl` out and stop it after the fade, cancelable by a later play of `path`. */
function scheduleStop(path: string, howl: Howl): void {
  howl.fade(howl.volume(), 0, vol.themeFadeMs);
  const t = setTimeout(() => {
    howl.stop();
    pendingStops.delete(path);
  }, vol.themeFadeMs);
  pendingStops.set(path, t);
}

/** Start (or restart) a looping bed at `path`, canceling any pending stop on that same
 *  path so a stale fade-out timer can't kill the sound we're starting here. */
function startBed(path: string, volume: number): Howl {
  const pending = pendingStops.get(path);
  if (pending) {
    clearTimeout(pending);
    pendingStops.delete(path);
  }
  const h = howlFor(path, true, 0, true); // beds stream (html5) — long loops, not low-latency SFX
  h.mute(muted);
  h.play();
  h.fade(0, volume, vol.themeFadeMs);
  return h;
}

/** Unlock the AudioContext from a user gesture (the PLAY click). */
export async function initAudio(): Promise<void> {
  const ctx = Howler.ctx;
  if (ctx && ctx.state === "suspended") await ctx.resume();
}

export function isAudioInitialized(): boolean {
  return Howler.ctx ? Howler.ctx.state === "running" : false;
}

/**
 * Pre-construct every SFX Howl so it's fetched + decoded BEFORE the first play — without this
 * the first bounce/launch/chime decodes its sample on demand, causing an audible hitch on the
 * opening launch (worst on mobile). howlFor caches, so a later playSfx reuses these. Safe to
 * call before the AudioContext unlocks: Howl construction just loads/decodes; nothing plays.
 * Idempotent (cached). Call behind the LoadingScreen so the decode overlaps the splash.
 */
export function preloadSfx(): void {
  for (const path of Object.values(audioCfg.sfx) as string[]) {
    howlFor(path, false, vol.sfx); // construct + cache (loads + decodes)
  }
  for (const path of Object.values(audioCfg.ui) as string[]) {
    howlFor(path, false, vol.sfx); // UI cues too — no first-click hover/click hitch
  }
}

function playSfx(id: SfxId, opts?: { rate?: number; volume?: number }): void {
  const path = (audioCfg.sfx as Record<string, string>)[id];
  if (!path) return;
  const h = howlFor(path, false, vol.sfx);
  // Set rate + volume on THIS play instance (the play id), not globally on the cached Howl —
  // overlapping SFX (rapid bounces) must not abruptly re-level/re-pitch each other's in-flight
  // plays. A per-pad voice (padVoice) passes rate/volume so each pad type sounds distinct.
  const playId = h.play();
  // Howler's play() can return undefined on a malformed/zero-length sample; @types/howler
  // types it as number, so guard before per-play rate/volume (they'd silently NOOP otherwise).
  if (playId == null) return;
  if (opts?.rate != null && opts.rate !== 1) h.rate(opts.rate, playId);
  h.volume(vol.sfx * sfxVolume * (opts?.volume ?? 1), playId);
}

/** Set the SFX bus level [0,1], independent of music/ambient. */
export function setSfxVolume(v: number): void {
  sfxVolume = Math.max(0, Math.min(1, v));
}

/** Set the MUSIC bus level [0,1] and re-level the live music bed (no fade — immediate). */
export function setMusicVolume(v: number): void {
  musicVolume = Math.max(0, Math.min(1, v));
  if (music) music.volume(musicTarget());
}

/** Set the AMBIENT bus level [0,1] and re-level the live ambient bed. */
export function setAmbientVolume(v: number): void {
  ambientVolume = Math.max(0, Math.min(1, v));
  if (ambient) ambient.volume(ambientTarget());
}

// ── SFX API (same surface the game already calls) ──────────────────────────────
/** Per-pad bounce VOICE: each pad type gets a distinct sample + pitch + level (padVoice),
 *  and a harder impact (strength→1) brightens the pitch — so every pad sounds like itself and
 *  no two bounces are quite identical. */
export function playBounce(type: TrampType, strength = 1): void {
  const v = padVoice(type, strength);
  playSfx(v.sample, { rate: v.rate, volume: v.volume });
}
/** Low-end THUMP layer on landing, mirroring the Light/Medium/Heavy haptic split — the impact
 *  sample pitched way down (a body-felt thud under the bright bounce), louder + lower the
 *  harder the hit. Gated below a soft threshold so gentle settles don't thud. */
export function playThump(strength: number): void {
  const s = Math.max(0, Math.min(1, strength));
  if (s < 0.25) return; // Light taps stay silent on the thump layer (haptic Light parallel)
  // Pitch DOWN with strength (heavier = lower/bigger), volume up — the sub-bass of the impact.
  playSfx("bounce", { rate: 0.5 - s * 0.18, volume: 0.4 + s * 0.5 });
}
/** Launch whoosh scaled by charge: a soft release is a low slow whoosh, a max charge a fast
 *  bright one (rate 0.85→1.25, volume 0.7→1.1) — playLaunch used to ignore the charge. */
export function playLaunch(charge = 1): void {
  const c = Math.max(0, Math.min(1, charge));
  playSfx("launch", { rate: 0.85 + c * 0.4, volume: 0.7 + c * 0.4 });
}
/** Rising-pitch combo blip: a clean bounce at combo N plays the bounce sample pitched up by
 *  the streak (rate 1 + combo·0.06), so a hot streak audibly climbs. Resets when the combo
 *  breaks (caller just stops calling it / passes 0). */
export function playComboBlip(combo: number): void {
  const n = Math.max(0, Math.min(MAX_COMBO, Math.floor(combo)));
  if (n < 1) return;
  playSfx("bounce", { rate: 1 + n * 0.06, volume: 0.5 });
}
export function playSplat(): void {
  playSfx("splat");
}
/** Game-over death sting: a gooey explosion blowout, with the music ducked so it punches. The
 *  bespoke "downer" feel comes from pitching the explosion sample down a touch. */
export function playDeath(): void {
  playSfx("death", { rate: 0.85 });
  duckMusic(900);
}

// ── UI interface sounds (shadcn overlay: hover/click/confirm/cancel/popup/coin) ──
type UiId = keyof typeof audioCfg.ui;
const uiVolume = vol.ui ?? 0.5;

/** Play a UI interface cue (hover/click/confirm/cancel/popup/coin) at the UI bus level. Safe
 *  no-op before the AudioContext unlocks, like every cue. */
export function playUi(id: UiId): void {
  const path = (audioCfg.ui as Record<string, string>)[id];
  if (!path) return;
  const h = howlFor(path, false, vol.sfx);
  const playId = h.play();
  if (playId == null) return;
  h.volume(uiVolume * sfxVolume, playId);
}
/** Crystal pickup with pitched round-robin variation — a multi-gather run (magnet sweep,
 *  dense cluster) plays an ascending-ish spread with no two adjacent gems at the same pitch,
 *  so it reads as a hand-played sparkle run rather than one looped blip. */
const chimeRate = createPitchVariation([0.92, 1.0, 1.08, 1.16, 1.24]);
export function playChime(): void {
  playSfx("crystal", { rate: chimeRate() });
}
export function playPowerup(): void {
  playSfx("powerup");
}
/** Power-down cue when a power-up expires — the pickup sample pitched + leveled DOWN so it
 *  reads as the buff fading, distinct from the bright pickup. */
export function playPowerdown(): void {
  playSfx("powerup", { rate: 0.6, volume: 0.55 });
}
/** Combo-milestone fanfare: a short celebratory stinger when a clean streak hits the "on
 *  fire" tier (combo cap), pitched up a bit from the altitude milestone so it reads as a
 *  distinct "streak!" cue. Fired once per streak by the caller. */
export function playComboFanfare(): void {
  playSfx("milestone", { rate: 1.25, volume: 0.9 });
}
/** Bright arcade stinger when the blob crosses a 100m milestone. */
export function playMilestone(): void {
  playSfx("milestone");
}
/** Gold "new record" fanfare on a personal best. */
export function playRecord(): void {
  playSfx("record");
}

// ── Music + ambient ────────────────────────────────────────────────────────────
const musicTracks = audioCfg.music as Record<string, string>;
const ambientBeds = audioCfg.ambient as Record<string, string>;
/** Above this altitude the in-game music swaps to the tense "high/space" track. */
const MUSIC_HIGH_START = audioCfg.musicHighStart;

/** Crossfade the music to `key` (a track in audioCfg.music); no-op if already on it. The old
 *  track fades out (scheduleStop) while the new one fades in (startBed). */
function setMusicTrack(key: string): void {
  if (key === musicKey) return;
  const path = musicTracks[key];
  if (!path) return;
  if (music && musicTracks[musicKey]) scheduleStop(musicTracks[musicKey], music);
  musicKey = key;
  music = startBed(path, musicTarget());
}

/** Swap the ambient bed to `band` (a canonical biome band, from biomeBandAt); no-op if
 *  unchanged. Throws if the band has no bed mapped in audio.json — every canonical band must
 *  map to a bed (no silent fallback; see [[blobolines-no-fallbacks]]). */
function setAmbientBand(band: string): void {
  if (band === ambientBand) return;
  const path = ambientBeds[band];
  if (!path) {
    throw new Error(`setAmbientBand: no ambient bed mapped for biome band "${band}".`);
  }
  if (ambient && ambientBeds[ambientBand]) scheduleStop(ambientBeds[ambientBand], ambient);
  ambientBand = band;
  ambient = startBed(path, ambientTarget());
}

/** Start the IN-GAME music + the ground ambient bed (called on the PLAY gesture). Crossfades
 *  from any menu track already playing. setMusicAltitude then drives the phase/biome changes. */
export function startMusic(): void {
  started = true;
  setMusicTrack("ingame");
  setAmbientBand("ground");
}

/** Start the MENU music (the calm menu loop). Only takes effect once the AudioContext is
 *  unlocked (after the first gesture) — safe no-op before that, like every cue. Returning to the
 *  menu after a run crossfades from the in-game track back to this. */
export function startMenuMusic(): void {
  if (!isAudioInitialized()) return;
  started = true;
  setMusicTrack("menu");
  // No ambient bed on the menu — just the music.
  if (ambient && ambientBeds[ambientBand]) scheduleStop(ambientBeds[ambientBand], ambient);
  ambient = null;
  ambientBand = "";
}

export function stopMusic(): void {
  if (!started) return;
  started = false;
  if (music && musicTracks[musicKey]) scheduleStop(musicTracks[musicKey], music);
  if (ambient && ambientBeds[ambientBand]) scheduleStop(ambientBeds[ambientBand], ambient);
  music = null;
  ambient = null;
  ambientBand = "";
  musicKey = "";
}

/** Pending un-duck timer, so overlapping ducks don't restore early. */
let unduckTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Duck (sidechain) the music under a big moment — quickly drop its volume, hold, then fade it
 * back over `ms`. Used on super-bounce / death / milestone so the stinger punches through. A
 * new duck during an active one resets the hold (no early restore). No-op if music isn't
 * playing or is muted.
 */
export function duckMusic(ms = 700): void {
  if (!music || muted) return;
  const bed = music; // capture identity — a stop/restart swaps `music` to a different Howl
  bed.fade(bed.volume(), musicTarget() * 0.25, 120); // fast dip
  if (unduckTimer) clearTimeout(unduckTimer);
  unduckTimer = setTimeout(() => {
    unduckTimer = null;
    // Restore ONLY if the same bed is still the live music (not a stop, not a restarted bed) —
    // otherwise we'd yank the volume of a freshly-started track. Re-read musicTarget() so a
    // slider drag DURING the duck restores to the new level, not a stale captured one.
    if (music === bed && !muted) bed.fade(bed.volume(), musicTarget(), ms);
  }, 180);
}

/** Drive the music PHASE + ambient BIOME from altitude (called as the blob climbs, throttled by
 *  the caller). The in-game track swaps to the tense high/space track past MUSIC_HIGH_START; the
 *  ambient bed follows the biome bands (ground→sky→stratosphere→space). Both crossfade. No-op on
 *  the menu track (only the in-game phase climbs). */
export function setMusicAltitude(height: number): void {
  if (!started) return;
  if (musicKey === "ingame" || musicKey === "highspace") {
    setMusicTrack(height >= MUSIC_HIGH_START ? "highspace" : "ingame");
  }
  setAmbientBand(biomeBandAt(height));
}

// ── Settings ─────────────────────────────────────────────────────────────────
export function setMasterVolume(v: number): void {
  Howler.volume(Math.max(0, Math.min(1, v)));
}
export function setMusicEnabled(on: boolean): void {
  muted = !on;
  if (music) music.mute(muted);
  if (ambient) ambient.mute(muted);
}
