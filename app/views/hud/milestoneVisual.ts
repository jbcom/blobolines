import { MILESTONE_TIER_COUNT } from "@/audio";

/**
 * Visual escalation for the milestone banner — the VISUAL counterpart to the audio stinger tiers.
 * Both key off the SAME `milestoneTierIndex(height)` (the single threshold source in the audio
 * config), so the banner LOOKS as grand as the crossing SOUNDS: a higher milestone gets a punchier
 * label, a brighter gold flash, and a bigger pop. Pure data — no DOM, no state.
 */
export interface MilestoneVisual {
  /** The celebratory label under the height number — escalates with the tier. */
  label: string;
  /** Gold screen-flash intensity [0,1] for this tier (0 = no flash on the base tier). */
  flash: number;
  /** Entry scale of the banner pop — higher tiers punch bigger. */
  scale: number;
}

const VISUALS: MilestoneVisual[] = [
  { label: "New height!", flash: 0, scale: 1.0 }, // tier 0 — the calm base beat
  { label: "Triumph!", flash: 0.45, scale: 1.12 }, // tier 1 — a gold glint
  { label: "Epic climb!", flash: 0.7, scale: 1.24 }, // tier 2 — a real flash
  { label: "Mega height!", flash: 0.95, scale: 1.4 }, // tier 3 — full celebration
];

// No silent fallback: the visual table must cover exactly the audio tier count, or a high milestone
// would index past the end (undefined) and the banner would render blank / unflashed. Surface a
// mismatch loudly at module load instead.
if (VISUALS.length !== MILESTONE_TIER_COUNT) {
  throw new Error(
    `milestoneVisual: ${VISUALS.length} visual tiers but ${MILESTONE_TIER_COUNT} audio tiers — they must match.`,
  );
}

/** The visual escalation for a milestone tier index (clamped to the table, so an out-of-range index
 *  degrades to the nearest real tier rather than rendering undefined). */
export function milestoneVisual(tierIndex: number): MilestoneVisual {
  const i = Math.max(0, Math.min(VISUALS.length - 1, tierIndex));
  return VISUALS[i];
}
