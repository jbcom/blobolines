import { getMusicOutput, getTone } from "./engine";

/**
 * Procedural ambient music — a soft synth pad drone + a gentle plucked sequence on a
 * Tone.Loop, generated (no files). Calm, dreamy, matching the painterly sky. Starts when
 * a run begins; stops on menu/game-over. Routes through the music gain bus (mute/volume).
 */

// biome-ignore lint/suspicious/noExplicitAny: Tone node types vary; kept local + disposed.
let nodes: any[] = [];
// biome-ignore lint/suspicious/noExplicitAny: Tone.Loop instance.
let loop: any = null;
// biome-ignore lint/suspicious/noExplicitAny: Tone.Filter on the pad drone, retuned by altitude.
let padFilterRef: any = null;
let playing = false;

const PAD_NOTES = ["C2", "G2"];
const SEQ = ["C4", "E4", "G4", "B4", "A4", "E4", "G4", "D4"];

export function startMusic(): void {
  const T = getTone();
  const out = getMusicOutput();
  if (!T || !out || playing) return;
  playing = true;

  // Warm low pad drone.
  const padFilter = new T.Filter(420, "lowpass").connect(out);
  const pad = new T.PolySynth(T.Synth, {
    oscillator: { type: "sawtooth" },
    envelope: { attack: 2, decay: 1, sustain: 0.5, release: 4 },
    volume: -20,
  }).connect(padFilter);
  pad.triggerAttack(PAD_NOTES);

  // Gentle plucked sequence.
  const pluck = new T.Synth({
    oscillator: { type: "triangle" },
    envelope: { attack: 0.01, decay: 0.3, sustain: 0, release: 0.4 },
    volume: -16,
  }).connect(out);

  let i = 0;
  loop = new T.Loop((time: number) => {
    pluck.triggerAttackRelease(SEQ[i % SEQ.length], 0.3, time);
    i++;
  }, "2n").start(0);

  T.getTransport().bpm.value = 76;
  T.getTransport().start();
  padFilterRef = padFilter;
  nodes = [pad, padFilter, pluck];
}

/**
 * Shift the ambient bed with altitude: as the blob climbs toward space the pad filter
 * opens up (brighter, more ethereal) and the tempo lifts slightly, so the music breathes
 * with the biome backdrop instead of staying flat. Called from the blob frame loop.
 */
export function setMusicAltitude(height: number): void {
  const T = getTone();
  if (!playing || !T || !padFilterRef) return;
  const climb = Math.min(Math.max(height, 0) / 1200, 1); // 0 ground .. 1 deep space
  // Pad filter cutoff opens 420Hz → 2200Hz with altitude (smoothed by Tone).
  padFilterRef.frequency.rampTo(420 + climb * 1780, 0.8);
  T.getTransport().bpm.rampTo(76 + climb * 16, 1.5);
}

export function stopMusic(): void {
  const T = getTone();
  if (!playing) return;
  playing = false;
  try {
    loop?.stop();
    loop?.dispose();
    T?.getTransport().stop();
  } catch {
    /* transport may not be running */
  }
  for (const n of nodes) {
    try {
      n.dispose();
    } catch {
      /* already disposed */
    }
  }
  nodes = [];
  loop = null;
  padFilterRef = null;
}
