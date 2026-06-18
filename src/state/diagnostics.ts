import type { EyeExpression, Vec3 } from "@/core/types";

export interface CloudAdherenceDiagnostics {
  padId: number;
  type: string;
  position: Vec3;
  relX: number;
  relZ: number;
  strength: number;
}

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
  /** Y of the last cloud the blob caught — the ground the contact shadow rests on. */
  groundY: number;
  /** Seconds spent settled on a pad without aiming/launching. Drives idle impatience. */
  idleSeconds?: number;
  /** Recent joy/excitement [0,1] from a strong/accurate catch. Decays in PlayerBlob. */
  excitement?: number;
  /** Soft-cloud contact envelope [0,1]. Drives cloud-coating/puddle/cling visuals. */
  cloudAdherence?: CloudAdherenceDiagnostics;
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
