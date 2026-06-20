import { AchievementToast } from "./AchievementToast";
import { AirNudgeIndicator } from "./AirNudgeIndicator";
import { Altimeter } from "./Altimeter";
import { BiomeBanner } from "./BiomeBanner";
import { ComboBadge } from "./ComboBadge";
import { CrystalCounter } from "./CrystalCounter";
import { DifficultyBanner } from "./DifficultyBanner";
import { DifficultyMeter } from "./DifficultyMeter";
import { LaunchInput } from "./LaunchInput";
import { MilestoneBanner } from "./MilestoneBanner";
import { NextPadRadar } from "./NextPadRadar";
import { Onboarding } from "./Onboarding";
import { PowerUpBadges } from "./PowerUpBadges";
import { RouteLandingToast } from "./RouteLandingToast";
import { ScreenFlash } from "./ScreenFlash";
import { SpeedLines } from "./SpeedLines";

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
      {/* effective route difficulty bump: MEDIUM!!! HARD!!! etc. */}
      <DifficultyBanner />
      {/* gentle "Entering The Stratosphere" note on first UP-crossing into a new biome band */}
      <BiomeBanner />
      {/* full-screen flash layer: gold combo / blue launch / red near-death */}
      <ScreenFlash />
      {/* route landing quality callout, fed by the certified golden-path scorer */}
      <RouteLandingToast />
      {/* active achievement unlock notification, fed by the real-time checker */}
      <AchievementToast />
      {/* radial motion streaks that fade in at high blob speed */}
      <SpeedLines />

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
          <DifficultyMeter />
        </div>
        {/* top-center: combo + power-ups. Capped to the center ~40vw so a wide high-tier "ON
            FIRE" badge (which also scales by --ui-scale) can't grow into the corner readouts on
            a narrow phone. */}
        <div
          className="absolute flex max-w-[40vw] flex-col items-center"
          style={{
            top: "calc(var(--safe-top) + 0.75rem)",
            left: "50%",
            transform: "translateX(-50%) scale(var(--ui-scale))",
            transformOrigin: "top center",
          }}
        >
          <ComboBadge />
          <PowerUpBadges />
          <AirNudgeIndicator />
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
        {/* lower-left: next-pad spatial radar. Sits above the safe area and away from the
            center launch-power affordance, while pointer-events remain disabled. */}
        <div
          className="absolute"
          style={{
            bottom: "calc(var(--safe-bottom) + 5rem)",
            left: "calc(var(--safe-left) + 1rem)",
            transform: "scale(var(--ui-scale))",
            transformOrigin: "bottom left",
          }}
        >
          <NextPadRadar />
        </div>
      </div>
    </>
  );
}
