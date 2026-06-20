import { usePunchOnChange } from "@app/hooks";
import { Flame } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { comboMultiplier } from "@/sim/launch";
import { useGameStore } from "@/state";
import { palette } from "@/styles/tokens";

/**
 * Clean-bounce combo multiplier. Appears with a springy pop once the streak is ≥2 and
 * ESCALATES BY TIER as the streak builds — the badge ramps gold → orange → goo-flame, grows,
 * glows harder, and flips to an "ON FIRE" state at 5×. The shown number is the REAL launch
 * multiplier (comboMultiplier).
 */

/** Visual escalation keyed on the streak length. The top "BLAZING" tier rewards the high combos the
 *  raised MAX_COMBO (12) now allows, so reaching for 10+ feels distinct from a mid streak. */
function comboTier(combo: number): { color: string; label: string; scale: number; glow: number } {
  if (combo >= 10) return { color: palette.tramp.violet, label: "BLAZING", scale: 1.42, glow: 30 };
  if (combo >= 7) return { color: palette.goo.flame, label: "ON FIRE", scale: 1.28, glow: 22 };
  if (combo >= 5) return { color: palette.tramp.orange, label: "ON FIRE", scale: 1.14, glow: 14 };
  return { color: palette.tramp.gold, label: "Clean combo", scale: 1, glow: 6 };
}

export function ComboBadge() {
  const combo = useGameStore((s) => s.run.combo);
  const show = combo >= 2;
  const multiplier = comboMultiplier(combo).toFixed(2);
  const tier = comboTier(combo);
  // Punch the badge with a scale + alternating tilt on every new clean bounce, so a
  // building streak feels percussive (Motion owns the appear/exit).
  const punchRef = usePunchOnChange<HTMLDivElement>(combo, { scale: 1.4, rotate: 6 });

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ scale: 0.6, opacity: 0, y: -8 }}
          animate={{ scale: tier.scale, opacity: 1, y: 0 }}
          exit={{ scale: 0.6, opacity: 0 }}
          transition={{ type: "spring", stiffness: 480, damping: 20 }}
          className="pointer-events-none flex flex-col items-center"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {/* The announced content is a real sr-only text node (not a mutating
              aria-label, which is unreliable); the visual badge below is decorative. */}
          <span className="sr-only">
            {tier.label === "ON FIRE" ? "On fire! " : ""}Clean combo {multiplier} times
          </span>
          <span
            aria-hidden
            className="text-[10px] font-bold uppercase tracking-[0.18em]"
            style={{ color: tier.color }}
          >
            {tier.label}
          </span>
          <div
            ref={punchRef}
            aria-hidden
            className="mt-1 flex items-center gap-1.5 rounded-full border px-3.5 py-1 backdrop-blur-md"
            style={{
              color: tier.color,
              borderColor: `${tier.color}80`,
              backgroundColor: `${tier.color}26`,
              boxShadow: `0 0 ${tier.glow}px ${tier.color}80`,
            }}
          >
            <Flame className="size-4" strokeWidth={2.5} />
            <span className="font-display text-lg font-bold leading-none">{multiplier}×</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
