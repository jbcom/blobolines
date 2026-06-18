/** Screen-space face intent for Blobby. The renderer projects a world target into NDC, then
 *  this pure helper turns that into a bounded local pupil dart. */

import { clamp } from "@/core/math";

export type FaceFocusNdc = readonly [x: number, y: number];

const DEFAULT_MAX_DART = 0.085;
const DART_GAIN = 0.09;

export function faceFocusDartFromNdc(
  blob: FaceFocusNdc,
  target: FaceFocusNdc,
  intensity = 1,
  maxDart = DEFAULT_MAX_DART,
): readonly [x: number, y: number] {
  const k = clamp(intensity, 0, 1) * DART_GAIN;
  return [
    clamp((target[0] - blob[0]) * k, -maxDart, maxDart),
    clamp((target[1] - blob[1]) * k, -maxDart, maxDart),
  ];
}
