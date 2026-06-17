/**
 * Round-robin variant picker — for any cue that has several interchangeable variants (samples
 * or, today, pitch offsets) so a rapidly-repeated sound never plays the SAME variant twice in
 * a row (the mechanical-repetition that makes arcade audio grate). Each picker holds its last
 * index and returns a different one each call. `rand` is injectable for deterministic tests;
 * defaults to Math.random (audio is render-side, so non-determinism is fine here).
 */

export interface VariantPicker {
  /** Index in [0, count) that is never the same as the previous call (when count > 1). */
  next(): number;
}

export function createVariantPicker(
  count: number,
  rand: () => number = Math.random,
): VariantPicker {
  let last = -1;
  return {
    next(): number {
      if (count <= 1) return 0;
      // First call (last < 0): pick freely from all `count` indices so index 0 isn't excluded.
      // After that: pick from the (count-1) indices excluding `last`, then map around it —
      // guarantees no immediate repeat in O(1) (no reject loop) with a uniform pick.
      if (last < 0) {
        last = Math.floor(rand() * count);
        return last;
      }
      let i = Math.floor(rand() * (count - 1));
      if (i >= last) i += 1;
      last = i;
      return i;
    },
  };
}

/**
 * A handy variant set for PITCH variation when there's only one sample: returns a rate from a
 * small spread (e.g. [-2,-1,0,1,2] semitone-ish steps) with no immediate repeat, so repeated
 * identical cues (crystal pickup, soft bounces) feel hand-played, not looped.
 */
export function createPitchVariation(
  steps: number[],
  rand: () => number = Math.random,
): () => number {
  const picker = createVariantPicker(steps.length, rand);
  return () => steps[picker.next()];
}
