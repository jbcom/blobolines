import { Altimeter } from "./Altimeter";
import { ComboBadge } from "./ComboBadge";
import { CrystalCounter } from "./CrystalCounter";
import { LaunchInput } from "./LaunchInput";
import { MilestoneBanner } from "./MilestoneBanner";
import { Onboarding } from "./Onboarding";
import { PowerUpBadges } from "./PowerUpBadges";
import { ScreenFlash } from "./ScreenFlash";

/**
 * In-game HUD layout. Top row: altimeter (left), combo (center), crystals (right),
 * laid out within the mobile safe area. Pointer-events are off on the container so the
 * canvas receives drags; individual readouts opt back in where tappable.
 */
export function Hud() {
  return (
    <>
      {/* full-screen drag-to-launch surface, behind the readouts */}
      <LaunchInput />
      {/* transient 100m-milestone celebration, centered over the canvas */}
      <MilestoneBanner />
      {/* full-screen flash layer: gold combo / blue launch / red near-death */}
      <ScreenFlash />
      {/* first-run drag-to-launch coachmark (until the first launch) */}
      <Onboarding />
      <div
        className="pointer-events-none flex h-full w-full flex-col p-4"
        style={{
          paddingTop: "calc(var(--safe-top) + 0.75rem)",
          paddingBottom: "calc(var(--safe-bottom) + 0.75rem)",
          paddingLeft: "calc(var(--safe-left) + 1rem)",
          paddingRight: "calc(var(--safe-right) + 1rem)",
        }}
      >
        {/* Device-aware scale: the readout row scales by --ui-scale (phone bigger so the
            HUD stays legible at arm's length; desktop baseline). transform-origin top keeps
            it anchored to the safe-area top while scaling. */}
        <div
          className="flex w-full items-start justify-between gap-3"
          style={{ transform: "scale(var(--ui-scale))", transformOrigin: "top center" }}
        >
          <Altimeter />
          <div className="flex flex-1 flex-col items-center pt-1">
            <ComboBadge />
            <PowerUpBadges />
          </div>
          <CrystalCounter />
        </div>
      </div>
    </>
  );
}
