import { Button } from "@app/components/ui";
import { Progress } from "@app/components/ui/progress";
import { Check, Copy, Flame, RotateCcw, Share2 } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { playRecord, startMusic, stopMusic } from "@/audio";
import type { BlobSkin } from "@/core/types";
import { NotificationType, notify } from "@/platform";
import { achievementById } from "@/sim/achievements";
import { DAILY_NS, dailyStanding, runHash } from "@/sim/daily";
import { comboMultiplier } from "@/sim/launch";
import { SKIN_COST, useGameStore, useWorldStore } from "@/state";
import { ROUTE_PROFILES } from "@/world";
import { renderShareCard } from "./shareCard";

/**
 * Game-over screen — shows the run's altitude + crystals against the all-time best, and
 * a replay CTA back into the height-chase. Reached when the blob falls too far.
 */
export function GameOver() {
  const height = useGameStore((s) => Math.max(0, Math.floor(s.run.height)));
  const crystals = useGameStore((s) => s.run.crystals);
  const maxCombo = useGameStore((s) => s.run.maxCombo);
  const recordDelta = useGameStore((s) => s.run.recordDelta);
  const runScore = useGameStore((s) => s.run.score);
  const scoreDelta = useGameStore((s) => s.run.scoreDelta);
  const lifetimeCrystals = useGameStore((s) => s.progress.crystals);
  const unlockedSkins = useGameStore((s) => s.progress.unlockedSkins);
  const best = useGameStore((s) => s.progress.bestHeight);
  const bestScore = useGameStore((s) => s.progress.bestScore);
  const setPhase = useGameStore((s) => s.setPhase);
  const setCustomizerIntent = useGameStore((s) => s.setCustomizerIntent);
  const resetRun = useGameStore((s) => s.resetRun);
  const setDailyRun = useGameStore((s) => s.setDailyRun);
  const resetWorld = useWorldStore((s) => s.reset);
  const dailyRun = useGameStore((s) => s.dailyRun);
  const seed = useWorldStore((s) => s.seed);
  const seedPhrase = useWorldStore((s) => s.seedPhrase);
  const difficulty = useWorldStore((s) => s.difficulty);

  const highScores = useGameStore((s) => s.progress.highScores) || [];
  // Daily streak — consecutive UTC days with a completed daily, advanced by commitBestHeight on a
  // daily run (so by the time this card renders it reflects this run). Shown only for daily runs.
  const dailyStreak = useGameStore((s) => s.progress.dailyStreak) ?? 0;
  // The new streak length IFF this run extended it (yesterday → today) — drives a celebratory
  // "Streak extended!" flourish vs. the plain count. 0 on a same-day replay or non-daily run.
  const streakExtended = useGameStore((s) => s.run.streakExtended) ?? 0;
  const reducedMotion = useReducedMotion();

  const freshAchievements = useGameStore((s) => s.run.unlockedAchievements) || [];

  // Daily-results standing: where this run places among the player's OWN prior attempts at THIS
  // run's daily tower. Use the seed phrase the run was ACTUALLY played on (from the world store) —
  // NOT a re-derived dailySeedPhrase(new Date()): a run finishing just before UTC midnight would
  // otherwise render against the NEXT day's seed (wrong/empty standing). The store already committed
  // this run into highScores before game-over, so it's counted.
  const dailyStand = dailyRun ? dailyStanding(highScores, seedPhrase, runScore) : null;

  // Daily run → a shareable verification hash binding this result to the run's seed. The date key
  // comes from the run's own seed phrase ("blobolines-daily-<YYYY-MM-DD>"), again so a midnight
  // rollover at render can't mislabel the tag with tomorrow's date.
  const dailyDateKey = seedPhrase.replace(`${DAILY_NS}-`, "");
  const runTag = dailyRun
    ? `Daily ${dailyDateKey} · ${ROUTE_PROFILES[difficulty].label} · ${runHash({
        seed,
        height,
        crystals,
        maxCombo,
        difficulty,
      })}`
    : `Seed ${seedPhrase}`;
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
    // "Climb again" is a normal random run — the daily is one attempt per day, so clear the flag
    // (and resetWorld() reseeds randomly, not from today's date).
    resetRun();
    setDailyRun(false);
    resetWorld();
    startMusic();
    setPhase("playing");
  };

  // Share the run — native share sheet where available, clipboard fallback otherwise.
  // Both are user-initiated (this button); the text carries no personal data.
  const [shared, setShared] = useState(false);
  const sharedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Clear a pending "Copied!" reset on unmount so it can't setState after the card closes.
  useEffect(
    () => () => {
      if (sharedTimer.current) clearTimeout(sharedTimer.current);
    },
    [],
  );
  const share = async () => {
    const text = dailyRun
      ? `I scored ${runScore.toLocaleString()} (${height}m) on the Blobolines ${runTag} 🫧`
      : `I scored ${runScore.toLocaleString()} (${height}m) in Blobolines (${runTag})! 🫧`;
    const url = "https://jbcom.github.io/blobolines/";
    try {
      if (typeof navigator === "undefined") return;
      // Best path: a branded PNG share card attached to the native share sheet — turns a daily
      // result into something visually shareable. Guarded by canShare({files}) so we only try it
      // where image share is actually supported (most mobile browsers); otherwise fall through.
      const card = await renderShareCard({
        score: runScore,
        height,
        dailyLabel: dailyRun ? `Daily ${dailyDateKey}` : null,
        streakDays: dailyRun ? dailyStreak : 0,
        crystals,
        maxCombo,
      }).catch(() => null);
      if (card && navigator.canShare) {
        const file = new File([card], "blobolines.png", { type: "image/png" });
        if (navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({ title: "Blobolines", text, url, files: [file] });
            return;
          } catch (err) {
            // User cancelled → done. ANY OTHER failure (an OS-level image-share restriction) must
            // fall through to the text share below, not abort the whole share.
            if (err instanceof Error && err.name === "AbortError") return;
          }
        }
      }
      // Text share (no image support / image share failed), then clipboard as the last fallback.
      if (navigator.share) {
        await navigator.share({ title: "Blobolines", text, url });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(`${text} ${url}`);
        setShared(true);
        if (sharedTimer.current) clearTimeout(sharedTimer.current);
        sharedTimer.current = setTimeout(() => setShared(false), 1600);
      }
    } catch {
      // user cancelled the share sheet, or clipboard denied — no-op.
    }
  };

  // Copy just this run's SEED phrase, so a player who had a great climb can replay this exact tower
  // (paste it into the title-screen seed field) or send it to a friend. Mirrors the share timer's
  // unmount-safe "Copied!" confirmation.
  const [seedCopied, setSeedCopied] = useState(false);
  const seedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (seedTimer.current) clearTimeout(seedTimer.current);
    },
    [],
  );
  const copySeed = async () => {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(seedPhrase);
      setSeedCopied(true);
      if (seedTimer.current) clearTimeout(seedTimer.current);
      seedTimer.current = setTimeout(() => setSeedCopied(false), 1600);
    } catch {
      // clipboard denied — no-op.
    }
  };

  // commitBestHeight already merged this run into `best`/`bestScore` before game-over, so on a
  // new record they equal this run's value. A record on EITHER axis (height OR composite
  // score) earns the trophy card — a crystal/combo-rich short run can set a score record
  // without a height record, and vice versa.
  // recordDelta is metres over the PREVIOUS best (0 on a tie or a non-record), so it — not
  // `height >= best` — is the true height-record signal: `best` already includes this run, so
  // `>=` would falsely flag a tied run as a record (and play the chime).
  const heightRecord = recordDelta > 0;
  const scoreRecord = scoreDelta > 0;
  const isRecord = heightRecord || scoreRecord;
  // Delta vs the all-time best: on a record show how far over the *previous* best we went;
  // on a losing run show how short. (best already includes this run, so a record's gap is
  // 0 against itself — fall back to a celebratory label instead of "+0m".)
  const shortBy = Math.max(0, best - height);
  const comboLabel = maxCombo >= 2 ? `${comboMultiplier(maxCombo).toFixed(2)}×` : "—";

  // Cheapest still-locked skin and progress toward affording it (crystals → next skin).
  const nextSkin = (Object.entries(SKIN_COST) as [BlobSkin, number][])
    .filter(([id]) => !unlockedSkins.includes(id))
    .sort((a, b) => a[1] - b[1])[0];
  // Guard the divide: a cost of 0 (test/config) would yield NaN/Infinity → treat as 100%.
  const nextSkinPct =
    nextSkin && nextSkin[1] > 0 ? Math.min(100, (lifetimeCrystals / nextSkin[1]) * 100) : 100;

  const toCustomizer = () => {
    setCustomizerIntent(true);
    resetRun();
    stopMusic();
    setPhase("menu");
  };

  // Distinct celebratory chime exactly once when a record card appears (a ref guard so
  // re-renders while isRecord stays true can't replay it). A game-over PEAK — a new record OR a
  // freshly-extended streak — also fires a one-shot success haptic, matching the in-run celebration
  // buzzes (max combo / perfect release / treasure). Gated on the haptics setting; web no-ops.
  const celebratedRef = useRef(false);
  useEffect(() => {
    const peak = isRecord || streakExtended > 0;
    if (peak && !celebratedRef.current) {
      celebratedRef.current = true;
      if (isRecord) playRecord();
      if (useGameStore.getState().settings.haptics) void notify(NotificationType.Success);
    }
  }, [isRecord, streakExtended]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      role="dialog"
      aria-labelledby="gameover-title"
      className="pointer-events-auto absolute inset-0 flex flex-col items-center justify-center gap-6 bg-bg/70 backdrop-blur-md"
      style={{
        // Honor notch/rounded-corner insets so the card never sits under a landscape notch.
        paddingLeft: "calc(var(--safe-left) + 1.5rem)",
        paddingRight: "calc(var(--safe-right) + 1.5rem)",
        paddingTop: "calc(var(--safe-top) + 1rem)",
        paddingBottom: "calc(var(--safe-bottom) + 1rem)",
      }}
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
          {isRecord ? "New record!" : "Splat!"}
        </h2>

        {/* SCORE is the headline metric — big, gold on a score record, with the +over-best
            flourish. Height/crystals/combo below are the breakdown that fed it. */}
        <div className="flex flex-col items-center gap-0.5">
          <span className="font-ui text-[11px] uppercase tracking-wider text-fg-subtle">Score</span>
          <span
            className={`font-display text-4xl font-bold tabular-nums ${
              scoreRecord ? "text-tramp-gold" : "text-cream"
            }`}
          >
            {runScore.toLocaleString()}
          </span>
          <span className="font-ui text-[11px] font-semibold text-fg-subtle">
            {scoreRecord
              ? `+${scoreDelta.toLocaleString()} over best`
              : `best ${bestScore.toLocaleString()}`}
          </span>
        </div>

        <div className="flex w-full flex-col gap-2 font-ui text-sm">
          <Row label="Altitude" value={`${height} m`} accent="text-accent" />
          <Row
            label="Best"
            value={`${best} m`}
            accent="text-tramp-gold"
            sub={
              heightRecord
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

        {runTag && (
          <button
            type="button"
            onClick={copySeed}
            // Tap the seed line to copy this run's seed — replay this exact tower or share it.
            className="pointer-events-auto flex items-center gap-1.5 rounded-lg px-2 py-1 text-center font-ui text-xs font-semibold text-fg-subtle tabular-nums hover:bg-bg/40"
            // The label reflects the COPIED state so a screen reader announces the confirmation, not
            // the stale "Copy seed…". For a daily run the seed phrase is an opaque internal
            // namespaced string, so the pre-copy label stays generic; a normal run reads its human
            // seed (what you'd paste to replay).
            aria-label={
              seedCopied
                ? "Seed copied to clipboard"
                : dailyRun
                  ? "Copy today's daily seed to replay this tower"
                  : `Copy seed ${seedPhrase} to replay this tower`
            }
          >
            {seedCopied ? (
              <>
                <Check className="size-3" aria-hidden /> Seed copied!
              </>
            ) : (
              <>
                <Copy className="size-3 opacity-70" aria-hidden /> {runTag}
              </>
            )}
          </button>
        )}

        {/* Daily-only "Today's tower" standing — how this run placed among the player's own
            attempts at today's shared seed (the daily's results payoff). */}
        {dailyStand && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            data-testid="daily-standing"
            className={`flex w-full flex-col items-center gap-0.5 rounded-xl border px-3 py-2 ${
              dailyStand.isPersonalDailyBest
                ? "border-tramp-gold/50 bg-tramp-gold/10"
                : "border-border/60 bg-bg/30"
            }`}
          >
            <span className="font-display text-[11px] font-bold uppercase tracking-wide text-fg-subtle">
              Today's tower
            </span>
            {dailyStand.isFirstAttempt ? (
              <span className="font-ui text-xs text-cream">Your first climb on today's tower</span>
            ) : dailyStand.isPersonalDailyBest ? (
              <span className="font-ui text-xs font-semibold text-tramp-gold">
                Best on today's tower yet! — {dailyStand.attemptsToday} attempts
              </span>
            ) : (
              <span className="font-ui text-xs text-cream tabular-nums">
                #{dailyStand.rank} of {dailyStand.attemptsToday} attempts today
              </span>
            )}
            {/* Daily streak badge — consecutive days. Reads as a warm flame; the count grows with
                the habit. Shown once the streak is a real run (≥1). When THIS run EXTENDED the streak
                (yesterday → today), it celebrates the moment ("Streak extended to N!") in a brighter
                gold with a pop; a same-day replay shows the calm "N-day streak" count. */}
            {dailyStreak >= 1 &&
              (streakExtended > 0 ? (
                <motion.span
                  data-testid="daily-streak"
                  initial={reducedMotion ? false : { scale: 0.7, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 420, damping: 16, delay: 0.15 }}
                  className="mt-0.5 flex items-center gap-1 font-display text-sm font-bold tabular-nums text-tramp-gold"
                >
                  <Flame className="size-4" aria-hidden />
                  Streak extended to {streakExtended}!
                </motion.span>
              ) : (
                <span
                  data-testid="daily-streak"
                  className="mt-0.5 flex items-center gap-1 font-ui text-xs font-semibold tabular-nums text-tramp-orange"
                >
                  {/* The visible "N-day streak" text is the accessible name (the flame is decorative). */}
                  <Flame className="size-3.5" aria-hidden />
                  {dailyStreak}-day streak
                </span>
              ))}
          </motion.div>
        )}

        {/* Newly-unlocked achievements this run — a small celebratory list. */}
        {freshAchievements.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex flex-col gap-1 rounded-xl border border-tramp-gold/40 bg-tramp-gold/10 px-3 py-2"
          >
            <span className="font-display text-xs font-bold text-tramp-gold uppercase tracking-wide">
              Achievement{freshAchievements.length > 1 ? "s" : ""} unlocked
            </span>
            {freshAchievements.map((id) => {
              const a = achievementById(id);
              if (!a) return null;
              return (
                <span key={id} className="font-ui text-xs text-cream">
                  <span className="font-semibold">{a.title}</span>
                  <span className="text-fg-muted"> — {a.description}</span>
                </span>
              );
            })}
          </motion.div>
        )}

        <Button ref={replayRef} cta size="lg" onClick={replay} className="w-full">
          <RotateCcw className="size-4" aria-hidden /> Climb again
        </Button>
        <Button variant="surface" cta size="lg" onClick={share} className="w-full">
          {shared ? (
            <>
              <Check className="size-4" aria-hidden /> Copied!
            </>
          ) : (
            <>
              <Share2 className="size-4" aria-hidden /> Share
            </>
          )}
        </Button>
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
