import { Button, buttonVariants, Dialog } from "@app/components/ui";
import {
  CalendarDays,
  Check,
  Gauge,
  HelpCircle,
  Palette,
  Play,
  Settings,
  Shuffle,
  Trophy,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { lazy, Suspense, useEffect, useState } from "react";
import { initAudio, startMenuMusic, startMusic } from "@/audio";
import { canonicalSeedPhrase, createSeedPhrase } from "@/core/math";
import type { WorldDifficulty } from "@/core/types";
import { cn } from "@/lib/utils";
import { dailyKey, dailySeedPhrase, dailyStreakStatus } from "@/sim/daily";
import { useGameStore, useWorldStore } from "@/state";
import { ROUTE_DIFFICULTIES, ROUTE_PROFILES } from "@/world";

// The menu modals are lazy-loaded — none is needed for the first paint (the menu CTA), so
// their code (+ the customizer's 3D preview, the manual's content) is split into its own chunk
// fetched only when the player opens one. Named exports → mapped to default for React.lazy.
const BlobCustomizer = lazy(() =>
  import("./BlobCustomizer").then((m) => ({ default: m.BlobCustomizer })),
);
const AchievementsModal = lazy(() =>
  import("./AchievementsModal").then((m) => ({ default: m.AchievementsModal })),
);
const ManualModal = lazy(() => import("./ManualModal").then((m) => ({ default: m.ManualModal })));
const SettingsModal = lazy(() =>
  import("./SettingsModal").then((m) => ({ default: m.SettingsModal })),
);

const DIFFICULTY_TONE: Record<WorldDifficulty, string> = {
  ready: "Big soft clouds, slow layers, and three forgiving route variants.",
  medium: "Drifting clouds and tighter cloud catches without precision stacks.",
  hard: "Wispy wobblers and faster cloud layers with sharper charge timing.",
  blobmare: "Storm splitters, thin catch windows, and quick cloud decisions.",
  ultraBlobmare: "Tiny cloud catches with very tight proof margins.",
  oneWrongMove: "Ultimate one-path cloud precision from the first launch.",
};

/**
 * Title / main menu. The blob identity, the one-line pitch, and the launch CTA into
 * the height-chase. Bottom-anchored so the 3D blob preview reads above it.
 */
export function TitleScreen() {
  const setPhase = useGameStore((s) => s.setPhase);
  const resetRun = useGameStore((s) => s.resetRun);
  const setDailyRun = useGameStore((s) => s.setDailyRun);
  const resetWorld = useWorldStore((s) => s.reset);
  const difficulty = useWorldStore((s) => s.difficulty);
  const best = useGameStore((s) => s.progress.bestHeight);
  // Daily-streak read for the Daily Challenge CTA. The pure status math is date-injected; reading the
  // clock in this UI layer is fine (only src/sim & src/engine must stay clock-free for determinism).
  const dailyStreakCount = useGameStore((s) => s.progress.dailyStreak) ?? 0;
  const lastDailyKey = useGameStore((s) => s.progress.lastDailyKey);
  const streakStatus = dailyStreakStatus(dailyStreakCount, lastDailyKey, dailyKey(new Date()));
  const reduced = useReducedMotion();
  const [customizing, setCustomizing] = useState(false);
  const [achievementsOpen, setAchievementsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [newGameOpen, setNewGameOpen] = useState(false);
  const [pendingDaily, setPendingDaily] = useState(false);
  const [pendingSeedPhrase, setPendingSeedPhrase] = useState("");

  // Open the customizer on arrival if the game-over card requested it, then clear the flag.
  const customizerIntent = useGameStore((s) => s.customizerIntent);
  const setCustomizerIntent = useGameStore((s) => s.setCustomizerIntent);
  useEffect(() => {
    if (customizerIntent) {
      setCustomizing(true);
      setCustomizerIntent(false);
    }
  }, [customizerIntent, setCustomizerIntent]);

  // Crossfade to the calm MENU music whenever the title is showing. Safe no-op until the
  // AudioContext is unlocked (first PLAY gesture), so on the very first menu it's silent and
  // on every return-to-menu after a run it fades the menu loop back in.
  useEffect(() => {
    startMenuMusic();
  }, []);

  /** Start a run. `daily` seeds the world from today's date so everyone climbs the same tower
   *  (and the game-over card shows a shareable hash); otherwise the world reseeds randomly. */
  const start = (daily: boolean, routeDifficulty: WorldDifficulty) => {
    // This click is the user gesture that unlocks the AudioContext; start ambient music
    // once it's ready.
    void initAudio().then(startMusic);
    resetRun();
    setDailyRun(daily);
    const seedPhrase =
      (pendingSeedPhrase.trim() ? canonicalSeedPhrase(pendingSeedPhrase) : "") ||
      (daily ? dailySeedPhrase(new Date()) : createSeedPhrase());
    resetWorld(seedPhrase, routeDifficulty);
    setPendingSeedPhrase(seedPhrase);
    setPhase("playing");
    setNewGameOpen(false);
  };
  const chooseRun = (daily: boolean) => {
    setPendingDaily(daily);
    setPendingSeedPhrase(daily ? dailySeedPhrase(new Date()) : createSeedPhrase());
    setNewGameOpen(true);
  };
  const play = () => chooseRun(false);
  const playDaily = () => chooseRun(true);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="pointer-events-auto flex h-full w-full flex-col items-center justify-end gap-6"
      style={{
        // Respect the notch/rounded-corner insets in landscape too (not just the bottom) so
        // the menu never tucks under a notch or the home indicator on a sideways phone.
        paddingBottom: "calc(var(--safe-bottom) + 2.5rem)",
        paddingLeft: "calc(var(--safe-left) + 1.5rem)",
        paddingRight: "calc(var(--safe-right) + 1.5rem)",
      }}
    >
      <div className="flex flex-col items-center text-center">
        <motion.h1
          initial={{ scale: 0.85, y: 12 }}
          animate={{ scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 18 }}
          className="font-display text-hero font-bold tracking-tight text-cream drop-shadow-[0_4px_0_rgba(0,0,0,0.45)]"
        >
          Blobolines
        </motion.h1>
        <p className="mt-1 max-w-xs font-ui text-base text-fg-muted">
          Launch a gooey blob through endless soft cloud pads.
        </p>
      </div>

      {/* The hero Play CTA reuses the shared button's variant styling (buttonVariants) so it
          matches the modal/card CTAs, but stays a motion.button for the spring squish. Press
          SQUISHES it (wide + short, like pressing a goo blob) and a touch of overshoot on
          release — gooier than a uniform shrink; honors reduced-motion (no squish). */}
      <motion.button
        type="button"
        onClick={play}
        whileTap={reduced ? { scale: 0.97 } : { scaleX: 1.08, scaleY: 0.82 }}
        whileHover={reduced ? undefined : { scale: 1.04 }}
        transition={{ type: "spring", stiffness: 500, damping: 14 }}
        className={cn(
          buttonVariants({ variant: "default", size: "lg", cta: true }),
          "gap-3 rounded-2xl px-10 py-4 text-xl",
        )}
      >
        Play <Play className="size-5 fill-current" aria-hidden />
      </motion.button>

      {/* Daily Challenge — same tower for everyone today (date-seeded); the game-over card
          shows a shareable run hash. A quieter secondary CTA below the main Play. When the player
          has a live daily streak it carries a flame badge; an at-risk streak (alive but today not
          yet played) glows warm to nudge a return-play, and a secured one shows a check. */}
      <button
        type="button"
        onClick={playDaily}
        className={cn(
          "-mt-1 flex min-h-11 flex-col items-center gap-0.5 rounded-xl border px-4 py-2 font-ui text-sm font-semibold transition-colors",
          streakStatus.state === "atRisk"
            ? "border-tramp-gold/70 text-cream hover:border-tramp-gold"
            : "border-border text-fg-muted hover:text-cream",
        )}
      >
        <span className="flex items-center gap-2">
          <CalendarDays className="size-4" aria-hidden /> Daily Challenge
          {streakStatus.state !== "none" && streakStatus.state !== "expired" && (
            <span className="flex items-center gap-0.5 font-bold text-tramp-gold">
              <span aria-hidden>🔥{streakStatus.streak}</span>
              {streakStatus.state === "secured" && (
                <Check className="size-3.5" strokeWidth={3} aria-hidden />
              )}
              {/* The accessible streak description lives in a visually-hidden span (a11y rules
                  reject aria-label on a plain span); the flame/check above are decorative. */}
              <span className="sr-only">
                {streakStatus.streak}-day streak
                {streakStatus.state === "secured" ? ", secured today" : ", play today to keep it"}
              </span>
            </span>
          )}
        </span>
        {streakStatus.state === "atRisk" && (
          <span aria-hidden className="font-ui text-[11px] font-medium text-tramp-gold/90">
            Play today to keep your streak!
          </span>
        )}
      </button>

      <div className="flex items-center gap-5">
        <button
          type="button"
          onClick={() => setCustomizing(true)}
          className="-my-2 flex min-h-11 items-center gap-2 py-2 font-ui text-sm font-semibold text-fg-muted hover:text-cream"
        >
          <Palette className="size-4" aria-hidden /> Customize
        </button>
        <button
          type="button"
          onClick={() => setAchievementsOpen(true)}
          className="-my-2 flex min-h-11 items-center gap-2 py-2 font-ui text-sm font-semibold text-fg-muted hover:text-cream"
        >
          <Trophy className="size-4" aria-hidden /> Achievements
        </button>
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          className="-my-2 flex min-h-11 items-center gap-2 py-2 font-ui text-sm font-semibold text-fg-muted hover:text-cream"
        >
          <Settings className="size-4" aria-hidden /> Settings
        </button>
        <button
          type="button"
          onClick={() => setManualOpen(true)}
          className="-my-2 flex min-h-11 items-center gap-2 py-2 font-ui text-sm font-semibold text-fg-muted hover:text-cream"
        >
          <HelpCircle className="size-4" aria-hidden /> How to play
        </button>
      </div>

      {best > 0 && (
        <span className="font-ui text-xs font-semibold text-fg-subtle">
          Best climb · <span className="text-tramp-gold">{best}m</span>
        </span>
      )}

      {/* Mount each modal only once opened (Suspense covers the lazy chunk fetch), so the
          modals' code isn't loaded until the player actually opens one. */}
      <Suspense fallback={null}>
        {customizing && <BlobCustomizer open={customizing} onOpenChange={setCustomizing} />}
        {achievementsOpen && (
          <AchievementsModal open={achievementsOpen} onOpenChange={setAchievementsOpen} />
        )}
        {settingsOpen && <SettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />}
        {manualOpen && <ManualModal open={manualOpen} onOpenChange={setManualOpen} />}
      </Suspense>

      <Dialog
        open={newGameOpen}
        onOpenChange={setNewGameOpen}
        ariaLabel={pendingDaily ? "Daily challenge difficulty" : "New game difficulty"}
        testId="new-game-difficulty"
      >
        <div className="flex items-start gap-3">
          <div
            className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-tramp-gold"
            aria-hidden
          >
            <Gauge className="size-5" />
          </div>
          <div>
            <h2 className="font-display text-xl font-bold text-cream">
              {pendingDaily ? "Daily difficulty" : "New game"}
            </h2>
            <p className="mt-1 font-ui text-xs text-fg-subtle">
              Pick the landing leniency and aim help for this climb.
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2 rounded-lg border border-border bg-bg/30 p-2">
          <div className="min-w-0 flex-1">
            <div className="font-ui text-[10px] font-bold text-fg-subtle uppercase tracking-wide">
              Seed
            </div>
            <label htmlFor="new-game-seed" className="sr-only">
              Seed phrase
            </label>
            <input
              id="new-game-seed"
              value={pendingSeedPhrase}
              readOnly={pendingDaily}
              spellCheck={false}
              autoCapitalize="none"
              autoCorrect="off"
              onChange={(event) => setPendingSeedPhrase(event.currentTarget.value)}
              onBlur={() => setPendingSeedPhrase((value) => canonicalSeedPhrase(value))}
              className="h-7 w-full min-w-0 border-none bg-transparent p-0 font-display text-base font-bold text-cream tabular-nums outline-none placeholder:text-fg-subtle"
            />
          </div>
          {!pendingDaily && (
            <Button
              variant="surface"
              size="icon"
              aria-label="Shuffle seed"
              onClick={() => setPendingSeedPhrase(createSeedPhrase())}
            >
              <Shuffle className="size-4" aria-hidden />
            </Button>
          )}
        </div>

        <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {ROUTE_DIFFICULTIES.map((id) => {
            const active = id === difficulty;
            return (
              <Button
                key={id}
                variant={active ? "warm" : "surface"}
                className="h-auto w-full justify-start gap-3 whitespace-normal px-4 py-3 text-left"
                onClick={() => start(pendingDaily, id)}
              >
                <Play className="size-4 shrink-0 fill-current" aria-hidden />
                <span className="flex min-w-0 flex-col">
                  <span className="font-display text-sm font-bold">{ROUTE_PROFILES[id].label}</span>
                  <span className="font-ui text-xs font-medium opacity-80">
                    {DIFFICULTY_TONE[id]}
                  </span>
                </span>
              </Button>
            );
          })}
        </div>
      </Dialog>
    </motion.div>
  );
}
