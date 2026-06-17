/**
 * Game audio — real itch.io sample library played via Howler.js (see ./howler and
 * config/audio.json). Replaced the procedural Tone.js synthesis. The public cue surface
 * is unchanged, so game call sites are untouched.
 */
export {
  duckMusic,
  initAudio,
  isAudioInitialized,
  playBounce,
  playChime,
  playComboBlip,
  playComboFanfare,
  playLaunch,
  playMilestone,
  playPowerdown,
  playPowerup,
  playRecord,
  playSplat,
  playThump,
  preloadSfx,
  setAmbientVolume,
  setMasterVolume,
  setMusicAltitude,
  setMusicEnabled,
  setMusicVolume,
  setSfxVolume,
  startMusic,
  stopMusic,
} from "./howler";
