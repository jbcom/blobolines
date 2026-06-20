/**
 * Game audio — real itch.io sample library played via Howler.js (see ./howler and
 * config/audio.json). Replaced the procedural Tone.js synthesis. The public cue surface
 * is unchanged, so game call sites are untouched.
 */
export {
  duckMusic,
  initAudio,
  isAudioInitialized,
  MILESTONE_TIER_COUNT,
  milestoneTierFor,
  milestoneTierIndex,
  pauseMusic,
  playBounce,
  playChime,
  playComboBlip,
  playComboFanfare,
  playDeath,
  playLaunch,
  playMilestone,
  playPowerdown,
  playPowerup,
  playRecord,
  playSplat,
  playThump,
  playUi,
  preloadSfx,
  resumeMusic,
  setAmbientVolume,
  setMasterVolume,
  setMusicAltitude,
  setMusicEnabled,
  setMusicVolume,
  setSfxVolume,
  startMenuMusic,
  startMusic,
  stopMusic,
} from "./howler";
