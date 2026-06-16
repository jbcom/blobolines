/**
 * Audio engine — Tone.js, lazy-imported on the first user gesture (browser AudioContext
 * policy). Master → sfx/music gain channels. Adapted from arcade-cabinet (syntheteria).
 * All sound routes through here; calls before init are safe no-ops.
 */
import type { Gain } from "tone";

let Tone: typeof import("tone") | null = null;
let masterGain: Gain | null = null;
let sfxGain: Gain | null = null;
let musicGain: Gain | null = null;
let initialized = false;

let masterVolume = 0.8;
let musicEnabled = true;

/** Initialize on first gesture. Lazy-imports Tone so no AudioContext before interaction. */
export async function initAudio(): Promise<void> {
  if (initialized) return;
  Tone = await import("tone");
  await Tone.start();
  masterGain = new Tone.Gain(masterVolume).toDestination();
  sfxGain = new Tone.Gain(0.9).connect(masterGain);
  musicGain = new Tone.Gain(musicEnabled ? 0.5 : 0).connect(masterGain);
  initialized = true;
}

export function isAudioInitialized(): boolean {
  return initialized;
}

export function getTone(): typeof import("tone") | null {
  return Tone;
}

export function getSfxOutput(): Gain | null {
  return sfxGain;
}

export function getMusicOutput(): Gain | null {
  return musicGain;
}

export function setMasterVolume(v: number): void {
  masterVolume = Math.max(0, Math.min(1, v));
  if (masterGain && Tone) masterGain.gain.rampTo(masterVolume, 0.05);
}

export function setMusicEnabled(on: boolean): void {
  musicEnabled = on;
  if (musicGain && Tone) musicGain.gain.rampTo(on ? 0.5 : 0, 0.1);
}
