import { Pause } from "lucide-react";
import { useEffect } from "react";
import { pauseMusic, resumeMusic } from "@/audio";
import { useGameStore } from "@/state";

/**
 * In-run PAUSE control: a small top-corner button plus an Escape/P key handler that toggles the
 * paused phase (the physics stepper freezes; the PauseOverlay layers on). Mounted in the HUD, so it
 * only exists while playing/paused. Pausing ducks the music so the quiet break reads.
 */
export function PauseButton() {
  const togglePause = useGameStore((s) => s.togglePause);
  const phase = useGameStore((s) => s.phase);

  // Escape / P toggles the pause. Guarded to the in-run phases so it can't fire on menu/gameover
  // (HudOverlay only mounts this while playing/paused, but the listener is global, so re-check).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" && e.key.toLowerCase() !== "p") return;
      const p = useGameStore.getState().phase;
      if (p !== "playing" && p !== "paused") return;
      e.preventDefault();
      // Hold the music ducked while paused, restore it on resume — Escape/P toggles both ways.
      if (p === "playing") pauseMusic();
      else resumeMusic();
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
