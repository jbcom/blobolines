import { usePunchOnChange } from "@app/hooks";
import { Gem } from "lucide-react";
import { motion } from "motion/react";
import { useGameStore } from "@/state";

/** Crystals collected this run — the soft currency for blob skins. */
export function CrystalCounter() {
  const crystals = useGameStore((s) => s.run.crystals);
  // anime.js: spin-punch the gem on each pickup (the number keeps its Motion pop).
  const gemRef = usePunchOnChange<HTMLSpanElement>(crystals, { scale: 1.5, rotate: 24 });

  return (
    // Live region announces via VISIBLE text content (the value is NOT aria-hidden) —
    // mutating an aria-label is unreliable across screen readers. aria-atomic re-reads
    // the whole region; the sr-only "crystals" gives the bare number context.
    <div
      className="pointer-events-auto flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 backdrop-blur-md"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <span ref={gemRef} className="inline-flex" aria-hidden>
        <Gem className="size-4 text-blob-blue" strokeWidth={2.5} />
      </span>
      <motion.span
        key={crystals}
        initial={{ scale: 1.3 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 600, damping: 24 }}
        className="font-display text-xl font-bold leading-none text-cream"
      >
        {crystals}
      </motion.span>
      <span className="sr-only"> crystals</span>
    </div>
  );
}
