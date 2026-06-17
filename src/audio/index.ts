/**
 * Game audio — real itch.io sample library played via Howler.js (see ./howler and
 * config/audio.json). Replaced the procedural Tone.js synthesis. The public cue surface
 * is unchanged, so game call sites are untouched.
 */
export {
  initAudio,
  isAudioInitialized,
  playBounce,
  playChime,
  playComboBlip,
  playLaunch,
  playMilestone,
  playPowerup,
  playRecord,
  playSplat,
  setMasterVolume,
  setMusicAltitude,
  setMusicEnabled,
  setSfxVolume,
  startMusic,
  stopMusic,
} from "./howler";
