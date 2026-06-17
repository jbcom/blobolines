import { Button, buttonVariants, Dialog } from "@app/components/ui";
import { CalendarDays, Gauge, HelpCircle, Palette, Play, Settings } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { lazy, Suspense, useEffect, useState } from "react";
import { initAudio, startMenuMusic, startMusic } from "@/audio";
import type { WorldDifficulty } from "@/core/types";
import { cn } from "@/lib/utils";
import { dailySeed } from "@/sim/daily";
import { useGameStore, useWorldStore } from "@/state";
import { ROUTE_DIFFICULTIES, ROUTE_PROFILES } from "@/world";

// The three menu modals are lazy-loaded — none is needed for the first paint (the menu CTA), so
// their code (+ the customizer's 3D preview, the manual's content) is split into its own chunk
// fetched only when the player opens one. Named exports → mapped to default for React.lazy.
const BlobCustomizer = lazy(() =>
  import("./BlobCustomizer").then((m) => ({ default: m.BlobCustomizer })),
);
const ManualModal = lazy(() => import("./ManualModal").then((m) => ({ default: m.ManualModal })));
const SettingsModal = lazy(() =>
  import("./SettingsModal").then((m) => ({ default: m.SettingsModal })),
);

const DIFFICULTY_TONE: Record<WorldDifficulty, string> = {
  ready: "Readable slider and canted routes with generous landing lips.",
  medium: "More canted chains and compressed arcs without precision flat stacks.",
  hard: "Occasional flat precision arcs with tighter route margins.",
  blobmare: "Fast pattern changes, cant chains, and thin landing windows.",
  ultraBlobmare: "Tool-assisted-feeling routes with very tight proof margins.",
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
  const reduced = useReducedMotion();
  const [customizing, setCustomizing] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [newGameOpen, setNewGameOpen] = useState(false);
  const [pendingDaily, setPendingDaily] = useState(false);

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
    // The Date is read HERE (UI layer) and passed into the pure dailySeed — sim never calls
    // new Date(). undefined seed = random reseed for a normal run.
    resetWorld(daily ? dailySeed(new Date()) : undefined, routeDifficulty);
    setPhase("playing");
    setNewGameOpen(false);
  };
  const chooseRun = (daily: boolean) => {
    setPendingDaily(daily);
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
          Bounce a gooey blob as high as you can up endless springy trampolines.
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
          shows a shareable run hash. A quieter secondary CTA below the main Play. */}
      <button
        type="button"
        onClick={playDaily}
        className="-mt-1 flex min-h-11 items-center gap-2 rounded-xl border border-border px-4 py-2 font-ui text-sm font-semibold text-fg-muted hover:text-cream"
      >
        <CalendarDays className="size-4" aria-hidden /> Daily Challenge
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
              Pick the route pattern for this climb.
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-2">
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
