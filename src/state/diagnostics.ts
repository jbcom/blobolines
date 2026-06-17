import type { EyeExpression, Vec3 } from "@/core/types";

/**
 * Live diagnostics snapshot of the blob + environment. PlayerBlob writes it each frame;
 * the dev harness reads it to dump before/after JSON around a fired event, so we can see
 * exactly how the event changed the blob and the world. Dev tooling only.
 */
export interface BlobDiagnostics {
  position: Vec3;
  velocity: Vec3;
  speed: number;
  airborne: boolean;
  expression: EyeExpression;
  squash: number;
  maxHeight: number;
  /** Y of the highest pad the blob has landed on this run — the ground the contact shadow
   *  rests on (so it sits on the pad below, not at the blob, as the blob arcs up). */
  groundY: number;
  /** Seconds spent settled on a pad without aiming/launching. Drives idle impatience. */
  idleSeconds?: number;
  /** Recent joy/excitement [0,1] from a strong/accurate bounce. Decays in PlayerBlob. */
  excitement?: number;
}

let snapshot: BlobDiagnostics = {
  position: [0, 0, 0],
  velocity: [0, 0, 0],
  speed: 0,
  airborne: false,
  expression: "idle",
  squash: 1,
  maxHeight: 0,
  groundY: 0,
  idleSeconds: 0,
  excitement: 0,
};

export function setBlobDiagnostics(d: BlobDiagnostics): void {
  snapshot = d;
}

export function getBlobDiagnostics(): BlobDiagnostics {
  return snapshot;
}
