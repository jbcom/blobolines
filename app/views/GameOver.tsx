import { Progress } from "@app/components/ui/progress";
import { Check, RotateCcw, Share2 } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { playChime, startMusic, stopMusic } from "@/audio";
import type { BlobSkin } from "@/core/types";
import { comboMultiplier } from "@/sim/launch";
import { SKIN_COST, useGameStore, useWorldStore } from "@/state";

/**
 * Game-over screen — shows the run's altitude + crystals against the all-time best, and
 * a replay CTA back into the height-chase. Reached when the blob falls too far.
 */
export function GameOver() {
  const height = useGameStore((s) => Math.max(0, Math.floor(s.run.height)));
  const crystals = useGameStore((s) => s.run.crystals);
  const maxCombo = useGameStore((s) => s.run.maxCombo);
  const recordDelta = useGameStore((s) => s.run.recordDelta);
  const lifetimeCrystals = useGameStore((s) => s.progress.crystals);
  const unlockedSkins = useGameStore((s) => s.progress.unlockedSkins);
  const best = useGameStore((s) => s.progress.bestHeight);
  const setPhase = useGameStore((s) => s.setPhase);
  const setCustomizerIntent = useGameStore((s) => s.setCustomizerIntent);
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

  // Share the run — native share sheet where available, clipboard fallback otherwise.
  // Both are user-initiated (this button); the text carries no personal data.
  const [shared, setShared] = useState(false);
  const share = async () => {
    const text = `I climbed ${height}m in Blobolines! 🫧`;
    const url = "https://jbcom.github.io/blobolines/";
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: "Blobolines", text, url });
      } else if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(`${text} ${url}`);
        setShared(true);
        setTimeout(() => setShared(false), 1600);
      }
    } catch {
      // user cancelled the share sheet, or clipboard denied — no-op.
    }
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

  // Cheapest still-locked skin and progress toward affording it (crystals → next skin).
  const nextSkin = (Object.entries(SKIN_COST) as [BlobSkin, number][])
    .filter(([id]) => !unlockedSkins.includes(id))
    .sort((a, b) => a[1] - b[1])[0];
  const nextSkinPct = nextSkin ? Math.min(100, (lifetimeCrystals / nextSkin[1]) * 100) : 100;

  const toCustomizer = () => {
    setCustomizerIntent(true);
    resetRun();
    stopMusic();
    setPhase("menu");
  };

  // Distinct celebratory chime once when a record card appears.
  useEffect(() => {
    if (isRecord) playChime();
  }, [isRecord]);

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
        className={`flex w-full max-w-xs flex-col items-center gap-5 rounded-xl border bg-surface p-6 text-center ${
          isRecord ? "border-tramp-gold" : "border-border"
        }`}
        // Gold glow on a record card — the climb's trophy moment.
        style={isRecord ? { boxShadow: "0 0 32px var(--color-tramp-gold)" } : undefined}
      >
        <h2 id="gameover-title" className="font-display text-2xl font-bold text-cream">
          {isRecord ? "New best climb!" : "Splat!"}
        </h2>

        <div className="flex w-full flex-col gap-2 font-ui text-sm">
          <Row label="Altitude" value={`${height} m`} accent="text-accent" />
          <Row
            label="Best"
            value={`${best} m`}
            accent="text-tramp-gold"
            sub={
              isRecord
                ? recordDelta > 0
                  ? `+${recordDelta} m over best`
                  : "New record!"
                : shortBy > 0
                  ? `${shortBy} m short`
                  : undefined
            }
          />
          <Row label="Max combo" value={comboLabel} accent="text-tramp-orange" />
          <Row
            label="Crystals"
            value={`${crystals}`}
            accent="text-blob-blue"
            sub={`${lifetimeCrystals} lifetime`}
          />
        </div>

        {/* Delta-vs-best bar: this run's height as a fraction of the all-time best, so the
            gap to beat is visible at a glance (full + gold on a record). */}
        <div className="w-full">
          <Progress
            value={best > 0 ? Math.min(100, (height / best) * 100) : 100}
            aria-label="Run height as a fraction of best"
            className={isRecord ? "[&>div]:bg-tramp-gold" : undefined}
          />
        </div>

        {/* Crystals → next skin: progress toward affording the cheapest locked skin, tappable
            to jump straight into the customizer. Hidden once everything's unlocked. */}
        {nextSkin && (
          <button
            type="button"
            onClick={toCustomizer}
            className="flex w-full flex-col gap-1 rounded-lg p-1 text-left hover:bg-bg/40"
          >
            <span className="flex items-center justify-between font-ui text-[11px] text-fg-subtle">
              <span>
                Next skin: {lifetimeCrystals}/{nextSkin[1]} 💎
              </span>
              <span className="font-semibold text-blob-blue">Customize ›</span>
            </span>
            <Progress value={nextSkinPct} aria-label="Crystals toward the next skin" />
          </button>
        )}

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
          onClick={share}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-border py-2.5 font-display font-bold uppercase tracking-wider text-fg-muted hover:text-cream"
        >
          {shared ? (
            <>
              <Check className="size-4" aria-hidden /> Copied!
            </>
          ) : (
            <>
              <Share2 className="size-4" aria-hidden /> Share
            </>
          )}
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
