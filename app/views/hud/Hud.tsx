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
      {/* Readouts are ANCHORED to the safe-area corners, NOT stretched across the row. On a
          wide landscape/desktop screen a flex justify-between would fling the altimeter and
          crystals to opposite edges of a 2560px monitor (and float the combo far from both);
          corner-anchoring keeps each readout pinned where the thumb/eye expects it regardless
          of aspect ratio. Each scales by --ui-scale from its own corner origin. */}
      <div className="pointer-events-none absolute inset-0">
        {/* top-left: altimeter */}
        <div
          className="absolute"
          style={{
            top: "calc(var(--safe-top) + 0.75rem)",
            left: "calc(var(--safe-left) + 1rem)",
            transform: "scale(var(--ui-scale))",
            transformOrigin: "top left",
          }}
        >
          <Altimeter />
        </div>
        {/* top-center: combo + power-ups */}
        <div
          className="absolute flex flex-col items-center"
          style={{
            top: "calc(var(--safe-top) + 0.75rem)",
            left: "50%",
            transform: "translateX(-50%) scale(var(--ui-scale))",
            transformOrigin: "top center",
          }}
        >
          <ComboBadge />
          <PowerUpBadges />
        </div>
        {/* top-right: crystals */}
        <div
          className="absolute"
          style={{
            top: "calc(var(--safe-top) + 0.75rem)",
            right: "calc(var(--safe-right) + 1rem)",
            transform: "scale(var(--ui-scale))",
            transformOrigin: "top right",
          }}
        >
          <CrystalCounter />
        </div>
      </div>
    </>
  );
}
