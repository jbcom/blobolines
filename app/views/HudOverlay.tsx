import { useGameStore } from "@/state";
import { DevHarness } from "./DevHarness";
import { GameOver } from "./GameOver";
import { Hud } from "./hud";
import { TitleScreen } from "./TitleScreen";

/**
 * DOM UI overlay root above the canvas. Switches between the title screen (menu) and
 * the in-game HUD by store phase. Reads game state via the store bridge — never touches
 * three objects directly.
 */
export function HudOverlay() {
  const phase = useGameStore((s) => s.phase);

  return (
    <>
      {phase === "menu" && <TitleScreen />}
      {phase === "playing" && <Hud />}
      {phase === "gameover" && <GameOver />}
      <DevHarness />
    </>
  );
}
