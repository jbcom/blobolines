import { Button } from "@app/components/ui";
import { Play, RotateCcw, Settings as SettingsIcon } from "lucide-react";
import { motion } from "motion/react";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { startMenuMusic, stopMusic } from "@/audio";
import { useGameStore } from "@/state";

const SettingsModal = lazy(() =>
  import("./SettingsModal").then((m) => ({ default: m.SettingsModal })),
);

/**
 * In-run PAUSE overlay. Shown over the FROZEN scene (the physics stepper stops while `phase` is
 * "paused" — the run is held mid-air, not ended). Lets the player take a break, open Settings (mute,
 * volumes, reduce-motion), or quit to the menu. Resume / Escape / P returns to the climb exactly
 * where it was. Reads/writes only the store — never touches three objects.
 */
export function PauseOverlay() {
  const togglePause = useGameStore((s) => s.togglePause);
  const setPhase = useGameStore((s) => s.setPhase);
  const resetRun = useGameStore((s) => s.resetRun);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const resumeRef = useRef<HTMLButtonElement>(null);

  // Focus the primary action on open (WCAG 2.4.3).
  useEffect(() => {
    resumeRef.current?.focus();
  }, []);

  const quitToMenu = () => {
    resetRun();
    stopMusic();
    startMenuMusic();
    setPhase("menu");
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      role="dialog"
      aria-label="Paused"
      className="pointer-events-auto absolute inset-0 flex flex-col items-center justify-center gap-6 bg-bg/60 backdrop-blur-sm"
      style={{
        paddingLeft: "calc(var(--safe-left) + 1.5rem)",
        paddingRight: "calc(var(--safe-right) + 1.5rem)",
      }}
    >
      <motion.div
        initial={{ scale: 0.9, y: 10 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 280, damping: 20 }}
        className="flex w-full max-w-xs flex-col items-center gap-4 rounded-xl border border-border bg-surface p-6 text-center"
      >
        <h2 className="font-display text-2xl font-bold text-cream">Paused</h2>
        <Button ref={resumeRef} cta size="lg" onClick={togglePause} className="w-full">
          <Play className="size-4" aria-hidden /> Resume
        </Button>
        <Button
          variant="surface"
          cta
          size="lg"
          onClick={() => setSettingsOpen(true)}
          className="w-full"
        >
          <SettingsIcon className="size-4" aria-hidden /> Settings
        </Button>
        <button
          type="button"
          onClick={quitToMenu}
          className="flex items-center gap-1.5 font-ui text-xs font-semibold text-fg-subtle hover:text-fg-muted"
        >
          <RotateCcw className="size-3.5" aria-hidden /> Quit to menu
        </button>
      </motion.div>

      {settingsOpen && (
        <Suspense fallback={null}>
          <SettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />
        </Suspense>
      )}
    </motion.div>
  );
}
