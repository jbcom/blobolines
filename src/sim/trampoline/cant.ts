import { trampoline as trampCfg } from "@/config";
import type { Vec3 } from "@/core/types";

/**
 * Canted-cloud geometry (pure). A canted cloud catch tilts toward a lateral `cant` direction
 * [x,z], so its launch normal leans off straight-up — the rebound launches along that
 * normal and the blob is thrown sideways-and-up toward the next cloud (the navigability
 * building block; the world generator aims `cant` at the intended next pad).
 */

const TILT = trampCfg.cantedTiltRad;

/** Normalize a 2D lateral direction; returns [0,0] for a zero vector (flat pad). */
function unit2(x: number, z: number): [number, number] {
  const m = Math.hypot(x, z);
  return m < 1e-6 ? [0, 0] : [x / m, z / m];
}

/**
 * World-space surface normal (unit) for a pad canted toward `cant` by the configured tilt.
 * A zero/absent cant gives straight up. Tilting toward [cx,cz] leans the normal that way:
 *   normal = [sinθ·cx, cosθ, sinθ·cz].
 */
export function cantNormal(cant: readonly [number, number] | undefined, tilt = TILT): Vec3 {
  if (!cant) return [0, 1, 0];
  const [cx, cz] = unit2(cant[0], cant[1]);
  if (cx === 0 && cz === 0) return [0, 1, 0];
  const s = Math.sin(tilt);
  return [s * cx, Math.cos(tilt), s * cz];
}

/**
 * Membrane euler tilt [rotX, rotZ] (radians) so the pad mesh visually leans toward `cant`.
 * Tilting toward +x is a negative rotation about Z; toward +z is a positive rotation about
 * X — matching three's right-handed axes so the visual lean lines up with cantNormal.
 */
export function cantEuler(
  cant: readonly [number, number] | undefined,
  tilt = TILT,
): { rotX: number; rotZ: number } {
  if (!cant) return { rotX: 0, rotZ: 0 };
  const [cx, cz] = unit2(cant[0], cant[1]);
  return { rotX: tilt * cz, rotZ: -tilt * cx };
}
