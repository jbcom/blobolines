import type { GoldenPathProof, TrampolineSpec } from "@/core/types";

export const TARGET_ABOVE_GROUND = 0.5;

export interface RouteStep {
  source: TrampolineSpec | null;
  target: TrampolineSpec;
  proof: GoldenPathProof | null;
}

/**
 * Select the next intended trampoline from the player's progression floor, independent of
 * array ordering. When a source pad has the stored golden-path proof for that target, return
 * it too for post-landing scoring, diagnostics, and dev-harness route evidence.
 */
export function nextRouteStep(
  groundY: number,
  pads: readonly TrampolineSpec[],
  aboveGround = TARGET_ABOVE_GROUND,
): RouteStep | null {
  let target: TrampolineSpec | null = null;
  let minY = Number.POSITIVE_INFINITY;
  for (const pad of pads) {
    const y = pad.position[1];
    if (y > groundY + aboveGround && y < minY) {
      target = pad;
      minY = y;
    }
  }
  if (!target) return null;

  const source =
    pads.find(
      (pad) => pad.goldenPath?.toPadId === target?.id && pad.position[1] <= groundY + 0.8,
    ) ??
    pads.find((pad) => pad.goldenPath?.toPadId === target?.id) ??
    null;

  return {
    source,
    target,
    proof: source?.goldenPath ?? null,
  };
}
