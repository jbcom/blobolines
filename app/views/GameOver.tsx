import { RotateCcw } from "lucide-react";
import { motion } from "motion/react";
import { useGameStore, useWorldStore } from "@/state";

/**
 * Game-over screen — shows the run's altitude + crystals against the all-time best, and
 * a replay CTA back into the height-chase. Reached when the blob falls too far.
 */
export function GameOver() {
  const height = useGameStore((s) => Math.max(0, Math.floor(s.run.height)));
  const crystals = useGameStore((s) => s.run.crystals);
  const best = useGameStore((s) => s.progress.bestHeight);
  const setPhase = useGameStore((s) => s.setPhase);
  const resetRun = useGameStore((s) => s.resetRun);
  const resetWorld = useWorldStore((s) => s.reset);

  const replay = () => {
    resetRun();
    resetWorld();
    setPhase("playing");
  };

  const toMenu = () => {
    resetRun();
    setPhase("menu");
  };

  // commitBestHeight already merged this run into `best` before game-over, so on a new
  // record best === height. `>=` is therefore correct: it's a record exactly when this
  // run reached the (now-updated) best. A losing run has height < best.
  const isRecord = height >= best && height > 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="pointer-events-auto absolute inset-0 flex flex-col items-center justify-center gap-6 bg-bg/70 px-6 backdrop-blur-md"
    >
      <motion.div
        initial={{ scale: 0.85, y: 16 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 18 }}
        className="flex w-full max-w-xs flex-col items-center gap-5 rounded-xl border border-border bg-surface p-6 text-center"
      >
        <h2 className="font-display text-2xl font-bold text-cream">
          {isRecord ? "New best climb!" : "Splat!"}
        </h2>

        <div className="flex w-full flex-col gap-2 font-ui text-sm">
          <Row label="Altitude" value={`${height} m`} accent="text-accent" />
          <Row label="Crystals" value={`${crystals}`} accent="text-blob-blue" />
          <Row label="Best" value={`${best} m`} accent="text-tramp-gold" />
        </div>

        <button
          type="button"
          onClick={replay}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-3 font-display font-bold uppercase tracking-wider text-bg"
        >
          <RotateCcw className="size-4" /> Climb again
        </button>
        <button
          type="button"
          onClick={toMenu}
          className="font-ui text-xs font-semibold text-fg-subtle hover:text-fg-muted"
        >
          Back to menu
        </button>
      </motion.div>
    </motion.div>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="flex items-center justify-between border-border/60 border-b pb-1.5 last:border-0">
      <span className="text-fg-subtle">{label}</span>
      <span className={`font-display font-bold ${accent}`}>{value}</span>
    </div>
  );
}
