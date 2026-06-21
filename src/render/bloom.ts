import { Color } from "three";

/**
 * Bloom is SELECTIVE by luminance: the PostFX Bloom pass only blooms pixels whose LINEAR luminance
 * exceeds {@link BLOOM_THRESHOLD}. Bloom runs pre-tonemap (the EffectComposer disables renderer
 * tone mapping during the pass and reads the linear HDR buffer), so this threshold is a raw linear
 * value, not a tone-mapped one.
 *
 * The scene's lighting rig is hot — the key light (~2.25) pushes the BLOB and CLOUD *diffuse*
 * surfaces past linear 1.0. A low threshold therefore caught the whole lit playfield and bloomed it
 * into a milky-white wash (pale blob, pads drowned out). The threshold sits ABOVE that lit-diffuse
 * ceiling so only genuine bloom targets glow.
 *
 * Because lit diffuse is itself bright, a bloom TARGET (crystal, powerup, route gate) cannot rely on
 * being merely lit — its material must write a raw value ABOVE the threshold into the HDR buffer.
 * That means `toneMapped={false}` (so the value is NOT ACES-compressed toward ~1.0) plus an emissive
 * magnitude sized by {@link emissiveForBloom}. This keeps the threshold and its targets in ONE
 * relationship: change the threshold here and every target's glow floor follows.
 */
export const BLOOM_THRESHOLD = 2.5;

/** Headroom above the threshold for a bloom target's emissive floor, so a target glows clearly
 *  (not marginally) and survives the luminanceSmoothing ramp at the threshold edge. */
const BLOOM_TARGET_HEADROOM = 1.3;

const tmp = new Color();

/**
 * The `emissiveIntensity` that makes a `toneMapped={false}` MeshStandardMaterial of the given color
 * emit at the bloom-target floor (`BLOOM_THRESHOLD × headroom`) in linear luminance — so the
 * material reliably blooms regardless of its hue. Dimmer colors get a higher intensity; bright ones
 * a lower one, so every target reaches the same glow floor.
 */
export function emissiveForBloom(hex: string, headroom = BLOOM_TARGET_HEADROOM): number {
  tmp.set(hex); // three converts to linear on .set with the renderer's color management
  const lum = 0.2126 * tmp.r + 0.7152 * tmp.g + 0.0722 * tmp.b;
  // Floor the divisor so a near-black emissive color can't produce an absurd intensity.
  return (BLOOM_THRESHOLD * headroom) / Math.max(lum, 0.05);
}
