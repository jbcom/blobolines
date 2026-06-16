import { useDrag } from "@use-gesture/react";
import { useState } from "react";
import { computeAim } from "@/input";
import { requestLaunch, useGameStore } from "@/state";

/**
 * Full-screen launch input surface (PLAYING only). Drag back to aim + charge the
 * slingshot, release to launch the blob. Shows a live charge meter. Pointer-events on
 * so it captures drags above the canvas; the canvas still renders beneath it.
 */
export function LaunchInput() {
  const sensitivity = useGameStore((s) => s.settings.slingshotSensitivity);
  const [charge, setCharge] = useState(0);

  const bind = useDrag(({ movement: [mx, my], down, last }) => {
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
