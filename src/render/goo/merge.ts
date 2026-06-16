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
