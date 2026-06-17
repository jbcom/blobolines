import type { Vec3 } from "@/core/types";

/**
 * Goo-merge selection (pure). Given the blob and a set of droplet positions, decides
 * which droplets are close enough to union into the blob's merged goo Brush (the input
 * to three-bvh-csg's ADDITION pass), and their per-droplet merge weight (closer = more
 * fully merged, for a gooey stretch-and-pinch look). No three/CSG here — just the
 * spatial decision, so it's deterministic and unit-testable.
 */

export const MERGE_RADIUS = 2.6;

export interface DropletMerge {
  index: number;
  /** 0 (at the edge of merge range) .. 1 (overlapping the blob). */
  weight: number;
}

const dist = (a: Vec3, b: Vec3): number => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** A stretched goo NECK bridging the blob to a merging droplet — the signature
 *  World-of-Goo teardrop strand that thins and pinches as the droplet pulls away. */
export interface GooBridge {
  /** Midpoint between the blob surface and the droplet (where the neck's center sits). */
  midpoint: Vec3;
  /** Unit direction from the blob toward the droplet (the neck's long axis). */
  axis: Vec3;
  /** Half-length of the neck along `axis` (spans the gap between blob + droplet surfaces). */
  halfLength: number;
  /** Neck radius — thick when the droplet is close (just separating), thinning toward a pinch
   *  as the gap opens, so it reads as a stretching teardrop strand rather than a rigid tube. */
  radius: number;
}

/**
 * Compute the goo neck bridging the blob to a merging droplet, or null if no visible neck is
 * warranted (the droplet is essentially inside the blob — no gap to bridge — or so far the
 * strand would have pinched off). Pure geometry so it's deterministic + unit-testable; GooCsg
 * turns each bridge into a stretched brush unioned into the goo.
 *
 * The neck is a tapered tube along the blob→droplet axis: its length is the surface-to-surface
 * gap, and its radius shrinks as that gap grows (a near droplet has a fat neck, a far one a
 * thin pinching strand), scaled by the droplet's own radius so big droplets trail thicker necks.
 */
export function bridgeFor(
  blob: Vec3,
  blobRadius: number,
  droplet: Vec3,
  dropletRadius: number,
): GooBridge | null {
  const dx = droplet[0] - blob[0];
  const dy = droplet[1] - blob[1];
  const dz = droplet[2] - blob[2];
  const d = Math.hypot(dx, dy, dz);
  if (d < 1e-4) return null; // coincident — no axis, no neck

  const surfaceGap = d - blobRadius - dropletRadius;
  // Overlapping (gap <= 0): the spheres already fuse, so no separate neck is needed. Far beyond
  // the merge range: the strand has pinched off. Only bridge the in-between separating window.
  if (surfaceGap <= 0 || surfaceGap >= MERGE_RADIUS) return null;

  const axis: Vec3 = [dx / d, dy / d, dz / d];
  const halfLength = surfaceGap / 2;
  // Neck sits between the two surfaces: blob surface point + halfLength along the axis.
  const start = blobRadius;
  const mid = start + halfLength;
  const midpoint: Vec3 = [
    blob[0] + axis[0] * mid,
    blob[1] + axis[1] * mid,
    blob[2] + axis[2] * mid,
  ];

  // Thinning: 1 at the moment of separation (gap→0), → 0 as the gap reaches the pinch-off range.
  const thin = 1 - surfaceGap / MERGE_RADIUS;
  // Radius scales with the droplet size + the thinning factor (squared so it pinches sharply at
  // the end, the teardrop snap), with a small floor so a live neck is never zero-width.
  const radius = Math.max(0.04, dropletRadius * 0.55 * thin * thin);

  return { midpoint, axis, halfLength, radius };
}

/**
 * Droplets within MERGE_RADIUS of the blob, with a smooth 0..1 weight. Capped to
 * `maxMerges` (nearest first) so the per-frame CSG union cost stays bounded on mobile.
 */
export function selectMerges(
  blob: Vec3,
  blobRadius: number,
  droplets: readonly Vec3[],
  maxMerges = 6,
): DropletMerge[] {
  const range = blobRadius + MERGE_RADIUS;
  const candidates: DropletMerge[] = [];
  for (let i = 0; i < droplets.length; i++) {
    const d = dist(blob, droplets[i]);
    if (d <= range) {
      candidates.push({ index: i, weight: 1 - d / range });
    }
  }
  candidates.sort((a, b) => b.weight - a.weight);
  return candidates.slice(0, maxMerges);
}
