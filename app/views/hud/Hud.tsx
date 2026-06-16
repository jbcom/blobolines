import { Altimeter } from "./Altimeter";
import { ComboBadge } from "./ComboBadge";
import { CrystalCounter } from "./CrystalCounter";
import { LaunchInput } from "./LaunchInput";

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
      <div
        className="pointer-events-none flex h-full w-full flex-col p-4"
        style={{
          paddingTop: "calc(var(--safe-top) + 0.75rem)",
          paddingLeft: "calc(var(--safe-left) + 1rem)",
          paddingRight: "calc(var(--safe-right) + 1rem)",
        }}
      >
        <div className="flex w-full items-start justify-between gap-3">
          <Altimeter />
          <div className="flex flex-1 justify-center pt-1">
            <ComboBadge />
          </div>
          <CrystalCounter />
        </div>
      </div>
    </>
  );
}
