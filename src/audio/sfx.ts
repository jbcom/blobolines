/**
 * Procedural SFX — synthesized on the fly via Tone.js (no audio files), rate-limited so
 * rapid events don't pile up. The PoC's sound palette: bounce (by pad type), launch (by
 * strength), crystal chime, power-up, splat/explode. Adapted from syntheteria's pattern.
 */
import type { TrampType } from "@/core/types";
import { getSfxOutput, getTone } from "./engine";

const MIN_INTERVAL_MS = 45;
const lastPlay = new Map<string, number>();

function gate(key: string, now: number): boolean {
  const last = lastPlay.get(key) ?? 0;
  if (now - last < MIN_INTERVAL_MS) return false;
  lastPlay.set(key, now);
  return true;
}

/** Per-pad bounce pitch (Hz) — each type reads distinctly, incl. the super + ice bonus pads. */
const BOUNCE_PITCH: Record<TrampType, number> = {
  standard: 200,
  booster: 320,
  moving: 240,
  fragile: 150,
  super: 420, // triumphant high pop for the mega-launch
  ice: 540, // bright glassy ping
};

/** Springy bounce — pitch keyed to pad type. Ice gets a glassy metallic timbre. */
export function playBounce(type: TrampType, now = performance.now()): void {
  const T = getTone();
  const out = getSfxOutput();
  if (!T || !out || !gate(`bounce-${type}`, now)) return;
  const base = BOUNCE_PITCH[type] ?? 200;
  if (type === "ice") {
    // Glassy ping for ice — a short bright metallic hit, not the rubbery membrane.
    const synth = new T.MetalSynth({
      envelope: { attack: 0.001, decay: 0.18, release: 0.05 },
      harmonicity: 5.1,
      resonance: 4000,
      octaves: 1.2,
    }).connect(out);
    synth.triggerAttackRelease(base, 0.12);
    setTimeout(() => synth.dispose(), 500);
    return;
  }
  const synth = new T.MembraneSynth({
    pitchDecay: 0.04,
    octaves: 4,
    envelope: { attack: 0.001, decay: 0.22, sustain: 0, release: 0.1 },
  }).connect(out);
  synth.triggerAttackRelease(base, 0.18);
  setTimeout(() => synth.dispose(), 600);
}

/** Launch whoosh — brighter + longer with strength [0,1]. */
export function playLaunch(strength: number, now = performance.now()): void {
  const T = getTone();
  const out = getSfxOutput();
  if (!T || !out || !gate("launch", now)) return;
  const synth = new T.Synth({
    oscillator: { type: "sawtooth" },
    envelope: { attack: 0.005, decay: 0.3, sustain: 0, release: 0.2 },
  }).connect(out);
  const f0 = 180 + strength * 220;
  synth.triggerAttackRelease(f0, 0.25);
  synth.frequency.rampTo(f0 * 0.4, 0.3);
  setTimeout(() => synth.dispose(), 700);
}

/** Crystal pickup chime. */
export function playChime(now = performance.now()): void {
  const T = getTone();
  const out = getSfxOutput();
  if (!T || !out || !gate("chime", now)) return;
  const synth = new T.Synth({
    oscillator: { type: "triangle" },
    envelope: { attack: 0.002, decay: 0.18, sustain: 0, release: 0.1 },
  }).connect(out);
  const notes = ["D5", "E5", "A5", "D6"] as const;
  synth.triggerAttackRelease(notes[Math.floor((now / 137) % notes.length)], 0.16);
  setTimeout(() => synth.dispose(), 500);
}

/** Power-up collect — rising arpeggio. */
export function playPowerup(now = performance.now()): void {
  const T = getTone();
  const out = getSfxOutput();
  if (!T || !out || !gate("powerup", now)) return;
  // PolySynth so the arpeggio notes ring together instead of stealing one mono voice.
  const synth = new T.PolySynth(T.Synth, {
    oscillator: { type: "square" },
    envelope: { attack: 0.003, decay: 0.12, sustain: 0, release: 0.08 },
  }).connect(out);
  const t = T.now();
  const arp = ["C5", "E5", "G5", "C6"];
  for (let i = 0; i < arp.length; i++) synth.triggerAttackRelease(arp[i], 0.1, t + i * 0.06);
  setTimeout(() => synth.dispose(), 900);
}

/** Splat / game-over — noisy low thud. */
export function playSplat(now = performance.now()): void {
  const T = getTone();
  const out = getSfxOutput();
  if (!T || !out || !gate("splat", now)) return;
  const noise = new T.NoiseSynth({
    noise: { type: "brown" },
    envelope: { attack: 0.005, decay: 0.4, sustain: 0 },
  }).connect(out);
  noise.triggerAttackRelease(0.4);
  setTimeout(() => noise.dispose(), 800);
}
