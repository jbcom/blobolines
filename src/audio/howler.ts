import { Howl, Howler } from "howler";
import audioCfg from "@/config/audio.json";
import type { TrampType } from "@/core/types";
import { padVoice } from "./padVoice";

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
let started = false;
let muted = false;
/** SFX channel level [0,1], settable independently of music (settings.sfxVolume). */
let sfxVolume = 1;

function howlFor(path: string, loop: boolean, volume: number): Howl {
  let h = howls.get(path);
  if (!h) {
    h = new Howl({ src: [url(path)], loop, volume, html5: false });
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
  const h = howlFor(path, true, 0);
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

function playSfx(id: SfxId, opts?: { rate?: number; volume?: number }): void {
  const path = (audioCfg.sfx as Record<string, string>)[id];
  if (!path) return;
  const h = howlFor(path, false, vol.sfx);
  // Set rate + volume on THIS play instance (the play id), not globally on the cached Howl —
  // overlapping SFX (rapid bounces) must not abruptly re-level/re-pitch each other's in-flight
  // plays. A per-pad voice (padVoice) passes rate/volume so each pad type sounds distinct.
  const playId = h.play();
  if (opts?.rate && opts.rate !== 1) h.rate(opts.rate, playId);
  h.volume(vol.sfx * sfxVolume * (opts?.volume ?? 1), playId);
}

/** Set the SFX channel volume [0,1], independent of music. */
export function setSfxVolume(v: number): void {
  sfxVolume = Math.max(0, Math.min(1, v));
}

// ── SFX API (same surface the game already calls) ──────────────────────────────
/** Per-pad bounce VOICE: each pad type gets a distinct sample + pitch + level (padVoice),
 *  and a harder impact (strength→1) brightens the pitch — so every pad sounds like itself and
 *  no two bounces are quite identical. */
export function playBounce(type: TrampType, strength = 1): void {
  const v = padVoice(type, strength);
  playSfx(v.sample, { rate: v.rate, volume: v.volume });
}
export function playLaunch(_strength = 1): void {
  playSfx("launch");
}
export function playSplat(): void {
  playSfx("splat");
}
export function playChime(): void {
  playSfx("crystal");
}
export function playPowerup(): void {
  playSfx("powerup");
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
export function startMusic(): void {
  if (started) return;
  started = true;
  // startBed applies the current `muted` state and cancels any stale stop on that path —
  // without it a quick restart plays at full volume / gets killed by a leftover fade timer.
  music = startBed(audioCfg.music.play, vol.music);
  ambientBand = "sky";
  ambient = startBed(audioCfg.ambient.sky, vol.ambient);
}

export function stopMusic(): void {
  if (!started) return;
  started = false;
  if (music) scheduleStop(audioCfg.music.play, music);
  if (ambient) scheduleStop((audioCfg.ambient as Record<string, string>)[ambientBand], ambient);
  music = null;
  ambient = null;
  ambientBand = "";
}

/** Shift the ambient bed with altitude — swap to the airy "space" bed up high. */
export function setMusicAltitude(height: number): void {
  if (!started) return;
  const band = height > 650 ? "space" : "sky";
  if (band === ambientBand) return;
  const oldPath = (audioCfg.ambient as Record<string, string>)[ambientBand];
  const path = (audioCfg.ambient as Record<string, string>)[band];
  ambientBand = band;
  if (ambient) scheduleStop(oldPath, ambient);
  ambient = startBed(path, vol.ambient);
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
