import { RotateCcw } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useRef } from "react";
import { startMusic, stopMusic } from "@/audio";
import { comboMultiplier } from "@/sim/launch";
import { useGameStore, useWorldStore } from "@/state";

/**
 * Game-over screen — shows the run's altitude + crystals against the all-time best, and
 * a replay CTA back into the height-chase. Reached when the blob falls too far.
 */
export function GameOver() {
  const height = useGameStore((s) => Math.max(0, Math.floor(s.run.height)));
  const crystals = useGameStore((s) => s.run.crystals);
  const maxCombo = useGameStore((s) => s.run.maxCombo);
  const lifetimeCrystals = useGameStore((s) => s.progress.crystals);
  const best = useGameStore((s) => s.progress.bestHeight);
  const setPhase = useGameStore((s) => s.setPhase);
  const resetRun = useGameStore((s) => s.resetRun);
  const resetWorld = useWorldStore((s) => s.reset);
  const replayRef = useRef<HTMLButtonElement>(null);

  const toMenu = () => {
    resetRun();
    stopMusic();
    setPhase("menu");
  };

  // Move focus to the primary action when the dialog appears (WCAG 2.4.3), and let Escape
  // dismiss to the menu (expected for a modal). No focus TRAP is claimed (aria-modal is
  // intentionally omitted) — during gameover the HUD is unmounted, so the only focusables
  // are this dialog's own buttons; asserting aria-modal without enforcing it would lie.
  // biome-ignore lint/correctness/useExhaustiveDependencies: toMenu is stable for mount lifetime
  useEffect(() => {
    replayRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") toMenu();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const replay = () => {
    resetRun();
    resetWorld();
    startMusic();
    setPhase("playing");
  };

  // commitBestHeight already merged this run into `best` before game-over, so on a new
  // record best === height. `>=` is therefore correct: it's a record exactly when this
  // run reached the (now-updated) best. A losing run has height < best.
  const isRecord = height >= best && height > 0;
  // Delta vs the all-time best: on a record show how far over the *previous* best we went;
  // on a losing run show how short. (best already includes this run, so a record's gap is
  // 0 against itself — fall back to a celebratory label instead of "+0m".)
  const shortBy = Math.max(0, best - height);
  const comboLabel = maxCombo >= 2 ? `${comboMultiplier(maxCombo).toFixed(2)}×` : "—";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      role="dialog"
      aria-labelledby="gameover-title"
      className="pointer-events-auto absolute inset-0 flex flex-col items-center justify-center gap-6 bg-bg/70 px-6 backdrop-blur-md"
    >
      <motion.div
        initial={{ scale: 0.85, y: 16 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 18 }}
        className="flex w-full max-w-xs flex-col items-center gap-5 rounded-xl border border-border bg-surface p-6 text-center"
      >
        <h2 id="gameover-title" className="font-display text-2xl font-bold text-cream">
          {isRecord ? "New best climb!" : "Splat!"}
        </h2>

        <div className="flex w-full flex-col gap-2 font-ui text-sm">
          <Row label="Altitude" value={`${height} m`} accent="text-accent" />
          <Row
            label="Best"
            value={isRecord ? `${best} m` : `${best} m`}
            accent="text-tramp-gold"
            sub={isRecord ? "New record!" : shortBy > 0 ? `${shortBy} m short` : undefined}
          />
          <Row label="Max combo" value={comboLabel} accent="text-tramp-orange" />
          <Row
            label="Crystals"
            value={`${crystals}`}
            accent="text-blob-blue"
            sub={`${lifetimeCrystals} lifetime`}
          />
        </div>

        <button
          ref={replayRef}
          type="button"
          onClick={replay}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-3 font-display font-bold uppercase tracking-wider text-bg"
        >
          <RotateCcw className="size-4" aria-hidden /> Climb again
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

function Row({
  label,
  value,
  accent,
  sub,
}: {
  label: string;
  value: string;
  accent: string;
  sub?: string;
}) {
  return (
    <div className="flex items-center justify-between border-border/60 border-b pb-1.5 last:border-0">
      <span className="text-fg-subtle">{label}</span>
      <span className="flex items-baseline gap-2">
        {sub && <span className="text-[10px] font-semibold text-fg-subtle">{sub}</span>}
        <span className={`font-display font-bold ${accent}`}>{value}</span>
      </span>
    </div>
  );
}
