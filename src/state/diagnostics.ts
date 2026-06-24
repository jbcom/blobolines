import type { EyeExpression, Vec3 } from "@/core/types";

export interface CloudAdherenceDiagnostics {
  padId: number;
  type: string;
  position: Vec3;
  relX: number;
  relZ: number;
  strength: number;
}

export interface HazardDiagnostics {
  /** Horizontal wind acceleration in world X/Z (m/s²). */
  wind: readonly [number, number];
  /** Magnitude of the horizontal wind acceleration (m/s²). */
  windStrength: number;
  /** Wind strength normalized against the tuned maximum [0,1]. */
  windIntensity: number;
  /** Extra downward acceleration applied to the blob (m/s²). */
  downdraft: number;
  /** Downdraft strength normalized against the tuned maximum [0,1]. */
  downdraftIntensity: number;
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
  /** Whether the bubble powerup effect is currently active on the player. */
  bubbleActive?: boolean;
  /** Remaining duration of the bubble powerup in seconds. */
  bubbleRemaining?: number;
  /** Whether the player has a mid-air redirect/nudge charge available to use. */
  nudgeAvailable?: boolean;
  /** Late-run hazard forces currently affecting the blob. */
  hazards?: HazardDiagnostics;
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
  bubbleActive: false,
  bubbleRemaining: 0,
  nudgeAvailable: true,
};

export function setBlobDiagnostics(d: BlobDiagnostics): void {
  snapshot = d;
}

export function getBlobDiagnostics(): BlobDiagnostics {
  return snapshot;
}
