import type { EyeExpression } from "@/core/types";

/**
 * Eye expression state machine (pure). Maps the blob's motion + impact into one of the
 * expressive states, which the procedural eye meshes render by scaling:
 *   idle   — neutral, occasional blink
 *   squint — hard impact / heavy squash (eyes scrunch)
 *   wide   — big launch or fast ascent (eyes pop open)
 *   tear   — falling far / near death (eyes well up)
 *   blink  — brief full close (driven by a timer, not state)
 */

export interface ExpressionInput {
  vy: number;
  /** Recent impact amount [0,1]. */
  impact: number;
  /** Distance below the highest nearby platform (how far we've fallen). */
  fallDepth: number;
  airborne: boolean;
}

export interface ExpressionThresholds {
  wideAscentSpeed: number;
  squintImpact: number;
  tearFallDepth: number;
}

export const DEFAULT_THRESHOLDS: ExpressionThresholds = {
  wideAscentSpeed: 18,
  squintImpact: 0.5,
  tearFallDepth: 14,
};

export function classifyExpression(
  input: ExpressionInput,
  t: ExpressionThresholds = DEFAULT_THRESHOLDS,
): EyeExpression {
  // Falling toward death wins — tearing up is the strongest read.
  if (input.fallDepth > t.tearFallDepth && input.vy < 0) return "tear";
  // A fresh hard impact scrunches the eyes.
  if (input.impact > t.squintImpact) return "squint";
  // Rocketing upward pops them wide.
  if (input.airborne && input.vy > t.wideAscentSpeed) return "wide";
  return "idle";
}

export interface EyeShape {
  /** Vertical scale of the sclera (1 = open, 0 = closed). */
  openY: number;
  /** Overall eye scale (wide makes them bigger). */
  scale: number;
  /** Pupil scale (squint shrinks, wide enlarges). */
  pupil: number;
  /** 0..1 tear amount (drives a droplet). */
  tear: number;
}

/** Resolve an expression (+ blink phase) to concrete eye-mesh scale params. */
export function eyeShape(expression: EyeExpression, blink = 0): EyeShape {
  const base: EyeShape = { openY: 1, scale: 1, pupil: 1, tear: 0 };
  switch (expression) {
    case "squint":
      base.openY = 0.4;
      base.pupil = 0.8;
      break;
    case "wide":
      base.openY = 1.15;
      base.scale = 1.2;
      base.pupil = 1.25;
      break;
    case "tear":
      base.openY = 1.1;
      base.pupil = 1.3;
      base.tear = 1;
      break;
    default:
      break;
  }
  // Blink multiplies the vertical opening (1 → fully open, 0 → shut).
  base.openY *= 1 - Math.min(Math.max(blink, 0), 1);
  return base;
}

export interface MouthShape {
  /** Vertical openness (0 = flat line, 1 = wide open). */
  open: number;
  /** Width scale of the mouth. */
  width: number;
  /** Corner curve: +1 smile, 0 neutral, -1 frown. */
  curve: number;
}

/** Resolve an expression to a procedural mouth — Blobby's expressiveness beyond the eyes.
 *  idle = soft smile, wide (rocketing up) = open "wheee", squint (hard impact) = grimace,
 *  tear (falling to death) = open "o" of dread, blink uses the idle mouth. */
export function mouthShape(expression: EyeExpression): MouthShape {
  switch (expression) {
    case "wide":
      return { open: 0.85, width: 1.05, curve: 0.6 };
    case "squint":
      return { open: 0.15, width: 1.1, curve: -0.7 };
    case "tear":
      return { open: 0.7, width: 0.8, curve: -0.3 };
    default:
      return { open: 0.18, width: 1, curve: 0.7 }; // idle: gentle happy smile
  }
}
