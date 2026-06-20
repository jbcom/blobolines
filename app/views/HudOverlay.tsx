import { useGameStore } from "@/state";
import { DevHarness } from "./DevHarness";
import { GameOver } from "./GameOver";
import { Hud } from "./hud";
import { PauseOverlay } from "./PauseOverlay";
import { TitleScreen } from "./TitleScreen";

/**
 * DOM UI overlay root above the canvas. Switches between the title screen (menu) and
 * the in-game HUD by store phase. Reads game state via the store bridge — never touches
 * three objects directly.
 */
export function HudOverlay() {
  const phase = useGameStore((s) => s.phase);
  const inRun = phase === "playing" || phase === "paused";

  return (
    <>
      {phase === "menu" && <TitleScreen />}
      {/* The HUD stays mounted while paused (the run is frozen, not over); PauseOverlay layers on top.
          While paused the HUD wrapper is `inert` so it's removed from the a11y tree and can't take
          focus/pointer events — keyboard Tab and screen readers stay trapped in the modal overlay,
          and the frozen HUD beneath reads as visible-but-disabled. */}
      {inRun && (
        <div inert={phase === "paused" ? true : undefined} className="contents">
          <Hud />
        </div>
      )}
      {phase === "paused" && <PauseOverlay />}
      {phase === "gameover" && <GameOver />}
      <DevHarness />
    </>
  );
}
