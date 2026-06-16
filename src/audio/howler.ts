import { Howl, Howler } from "howler";
import audioCfg from "@/config/audio.json";
import type { TrampType } from "@/core/types";

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

function howlFor(path: string, loop: boolean, volume: number): Howl {
  let h = howls.get(path);
  if (!h) {
    h = new Howl({ src: [url(path)], loop, volume, html5: false });
    howls.set(path, h);
  }
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

function playSfx(id: SfxId): void {
  const path = (audioCfg.sfx as Record<string, string>)[id];
  if (!path) return;
  howlFor(path, false, vol.sfx).play();
}

// ── SFX API (same surface the game already calls) ──────────────────────────────
/** Per-pad bounce sample: ice gets the bright click, gentle pads the soft wood. */
export function playBounce(type: TrampType): void {
  const id: SfxId = type === "ice" ? "bounce_ice" : type === "fragile" ? "bounce_soft" : "bounce";
  playSfx(id);
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

// ── Music + ambient ────────────────────────────────────────────────────────────
export function startMusic(): void {
  if (started) return;
  started = true;
  music = howlFor(audioCfg.music.play, true, 0);
  music.play();
  music.fade(0, vol.music, vol.themeFadeMs);
  // Start the ground ambient bed.
  ambientBand = "sky";
  ambient = howlFor(audioCfg.ambient.sky, true, 0);
  ambient.play();
  ambient.fade(0, vol.ambient, vol.themeFadeMs);
}

export function stopMusic(): void {
  if (!started) return;
  started = false;
  for (const ch of [music, ambient]) {
    if (!ch) continue;
    ch.fade(ch.volume(), 0, vol.themeFadeMs);
    const c = ch;
    setTimeout(() => c.stop(), vol.themeFadeMs);
  }
  music = null;
  ambient = null;
  ambientBand = "";
}

/** Shift the ambient bed with altitude — swap to the airy "space" bed up high. */
export function setMusicAltitude(height: number): void {
  if (!started) return;
  const band = height > 650 ? "space" : "sky";
  if (band === ambientBand) return;
  ambientBand = band;
  const path = (audioCfg.ambient as Record<string, string>)[band];
  if (ambient) {
    ambient.fade(ambient.volume(), 0, vol.themeFadeMs);
    const old = ambient;
    setTimeout(() => old.stop(), vol.themeFadeMs);
  }
  ambient = howlFor(path, true, 0);
  ambient.play();
  ambient.fade(0, vol.ambient, vol.themeFadeMs);
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
