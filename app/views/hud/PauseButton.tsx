import { Pause } from "lucide-react";
import { useEffect } from "react";
import { pauseMusic } from "@/audio";
import { useGameStore } from "@/state";

/**
 * In-run PAUSE control: a small top-corner button plus an Escape/P key handler that ENTERS pause
 * (the physics stepper freezes; the PauseOverlay layers on). Mounted in the HUD, so it only exists
 * while playing/paused. Pausing ducks the music so the quiet break reads.
 *
 * This handler ONLY pauses (playing → paused). The RESUME side (paused → playing) lives in
 * PauseOverlay's own keydown listener, which is guarded on `!settingsOpen` — otherwise pressing
 * Escape to close the Settings modal layered over the pause overlay would also resume the run.
 */
export function PauseButton() {
  const togglePause = useGameStore((s) => s.togglePause);
  const phase = useGameStore((s) => s.phase);

  // Escape / P ENTERS pause. Guarded to `playing` only (re-checked from the store, since the
  // listener is global) so it never fires the resume direction — PauseOverlay owns resume.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" && e.key.toLowerCase() !== "p") return;
      if (useGameStore.getState().phase !== "playing") return;
      e.preventDefault();
      pauseMusic();
      togglePause();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePause]);

  // The button itself is shown only while actively playing (the PauseOverlay owns the paused state).
  if (phase !== "playing") return null;

  return (
    <button
      type="button"
      onClick={() => {
        pauseMusic();
        togglePause();
      }}
      aria-label="Pause"
      className="pointer-events-auto flex size-9 items-center justify-center rounded-full border border-border/50 bg-bg/55 text-cream/85 backdrop-blur-sm transition-colors hover:bg-bg/75"
    >
      <Pause className="size-4" aria-hidden />
    </button>
  );
}
