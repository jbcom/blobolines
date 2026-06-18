import { BLOB, STARTER_BLOB_Y } from "@/sim/physics";

export interface CloudCatchInput {
  padPosition: readonly [number, number, number];
  width: number;
  depth: number;
  blobPosition: readonly [number, number, number];
  blobVelocity: readonly [number, number, number];
}

export interface CloudCatch {
  relX: number;
  relZ: number;
  speed: number;
  strength: number;
  settleY: number;
  contactY: number;
}

export const CLOUD_BODY_HALF_HEIGHT = 0.72;
export const CLOUD_CATCH_HEADROOM = BLOB.radius * 0.86;
export const CLOUD_SETTLE_Y = STARTER_BLOB_Y;

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/** Elliptical footprint test for the soft cloud skin. Clouds are pass-through while Blobby is
 *  ascending; once descending inside this volume, adherence can catch and settle him. */
export function cloudCatch(input: CloudCatchInput): CloudCatch | null {
  const [px, py, pz] = input.padPosition;
  const [bx, by, bz] = input.blobPosition;
  const [, vy] = input.blobVelocity;
  if (vy > 0.05) return null;

  const halfW = Math.max(0.1, input.width * 0.5);
  const halfD = Math.max(0.1, input.depth * 0.5);
  const dx = bx - px;
  const dz = bz - pz;
  const ellipse = (dx / (halfW * 1.04)) ** 2 + (dz / (halfD * 1.04)) ** 2;
  if (ellipse > 1) return null;

  const settleY = py + CLOUD_SETTLE_Y;
  const minY = py - CLOUD_BODY_HALF_HEIGHT;
  const maxY = settleY + CLOUD_CATCH_HEADROOM;
  if (by < minY || by > maxY) return null;

  const verticalFit =
    1 - clamp(Math.abs(by - settleY) / (CLOUD_BODY_HALF_HEIGHT + BLOB.radius), 0, 1);
  const edgeFit = 1 - clamp(ellipse, 0, 1);
  return {
    relX: clamp(dx / input.width, -0.5, 0.5),
    relZ: clamp(dz / input.depth, -0.5, 0.5),
    speed: Math.abs(vy),
    strength: clamp(0.28 + verticalFit * 0.5 + edgeFit * 0.22, 0.25, 1),
    settleY,
    contactY: py + CLOUD_BODY_HALF_HEIGHT,
  };
}
