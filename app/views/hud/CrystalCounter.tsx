import { Gem } from "lucide-react";
import { motion } from "motion/react";
import { useGameStore } from "@/state";

/** Crystals collected this run — the soft currency for blob skins. */
export function CrystalCounter() {
  const crystals = useGameStore((s) => s.run.crystals);

  return (
    <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 backdrop-blur-md">
      <Gem className="size-4 text-blob-blue" strokeWidth={2.5} />
      <motion.span
        key={crystals}
        initial={{ scale: 1.3 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 600, damping: 24 }}
        className="font-display text-xl font-bold leading-none text-cream"
      >
        {crystals}
      </motion.span>
    </div>
  );
}
