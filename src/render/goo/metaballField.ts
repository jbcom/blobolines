import type { Vec3 } from "@/core/types";

/**
 * Metaball field packing (pure). Builds the WORLD-SPACE metaball centers + radii fed to
 * MetaballGooMaterial. The shader raymarches in world space (ro = the hull's world-space
 * surface position), so every center MUST be world-space too.
 *
 * Regression note: a prior version packed the blob at local (0,0,0) and droplets as
 * blob-relative offsets while the shader marched in world space — pinning the entire goo
 * field to the world origin. The goo rendered on the floor regardless of the blob's
 * height, and the eyes (correctly anchored at the blob) floated where the body should be.
 * Keep these centers in world space.
 */

export interface MetaballSource {
  position: Vec3;
  radius: number;
}

export interface MetaballField {
  /** Active metaball count (1 blob + merged droplets). */
  count: number;
  centers: Vec3[];
  radii: number[];
}

/** Squared world distance under which a droplet merges into the blob's goo. Kept tight
 *  (~1.6 units) so only freshly-flung droplets still touching the body blend in — once a
 *  droplet has separated/fallen it pinches off cleanly instead of stringing a long
 *  teardrop tail from the blob down to settled goo on the pad. */
export const MERGE_DIST_SQ = 2.6;

/**
 * Pack the blob body + nearby droplets into world-space metaball sources. Droplet 0 is
 * always the blob; only droplets within sqrt(MERGE_DIST_SQ) of the blob merge in (distant
 * ones render as free particles), capped to `maxBalls` total.
 */
export function packMetaballField(
  blob: Vec3,
  blobRadius: number,
  droplets: readonly MetaballSource[],
  maxBalls: number,
): MetaballField {
  const centers: Vec3[] = [[blob[0], blob[1], blob[2]]];
  const radii: number[] = [blobRadius];

  for (let i = 0; i < droplets.length && centers.length < maxBalls; i++) {
    const d = droplets[i];
    const dx = d.position[0] - blob[0];
    const dy = d.position[1] - blob[1];
    const dz = d.position[2] - blob[2];
    // Don't merge a droplet that has dropped clearly below the blob body — that's a
    // separated/settling droplet, and bridging it strings a teardrop neck down to the
    // pad. It pinches off as a free particle instead.
    if (dy < -(blobRadius + 0.4)) continue;
    if (dx * dx + dy * dy + dz * dz < MERGE_DIST_SQ) {
      centers.push([d.position[0], d.position[1], d.position[2]]);
      radii.push(d.radius);
    }
  }

  return { count: centers.length, centers, radii };
}
