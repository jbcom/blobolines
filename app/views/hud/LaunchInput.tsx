import { useDrag } from "@use-gesture/react";
import { useState } from "react";
import { computeAim, computeAirSteer } from "@/input";
import { getBlobDiagnostics, requestLaunch, setAirSteer, useGameStore } from "@/state";

/**
 * Full-screen input surface (PLAYING only). Dual-mode, matching the PoC:
 *  - blob resting on a pad → drag back to aim + charge the slingshot, release to launch.
 *  - blob airborne → drag to steer mid-air (X/Z), released → steering stops.
 * Pointer-events on so it captures drags above the canvas; the canvas renders beneath.
 */
export function LaunchInput() {
  const sensitivity = useGameStore((s) => s.settings.slingshotSensitivity);
  const [charge, setCharge] = useState(0);

  const bind = useDrag(({ movement: [mx, my], down, last }) => {
    const airborne = getBlobDiagnostics().airborne;

    if (airborne) {
      // Mid-air 3D steering: drag → continuous lateral force; release → stop.
      if (down) {
        const [sx, sz] = computeAirSteer(mx, my);
        setAirSteer(sx, sz);
      } else {
        setAirSteer(0, 0);
      }
      setCharge(0);
      return;
    }

    // Slingshot on a pad: charge while dragging, launch on release.
    const aim = computeAim(mx, my, { maxDragDist: 140, sensitivity });
    setCharge(down ? aim.strength : 0);
    if (last && aim.strength > 0.12) {
      requestLaunch({ dir: aim.dir, charge: aim.strength });
    }
  });

  return (
    <div {...bind()} className="pointer-events-auto absolute inset-0 touch-none">
      {charge > 0 && (
        <div className="absolute bottom-[18%] left-1/2 -translate-x-1/2">
          <div className="h-2 w-44 overflow-hidden rounded-full border border-border bg-bg/70">
            <div
              className="h-full rounded-full bg-gradient-to-r from-accent to-accent-warm"
              style={{ width: `${charge * 100}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
