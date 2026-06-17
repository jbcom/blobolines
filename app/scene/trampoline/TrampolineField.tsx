import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, useState } from "react";
import type { TrampolineSpec } from "@/core/types";
import { getBlobDiagnostics, useWorldStore } from "@/state";
import { Trampoline } from "./Trampoline";

/** How far below / above the blob to keep pads mounted (world units). */
export const WINDOW_BELOW = 40;
export const WINDOW_ABOVE = 120;
/** Re-evaluate the window only when the blob moves this far (avoid per-frame churn). */
export const WINDOW_STEP = 8;

/** Pure window filter: the pads to mount for a blob at `centerY` (the perf-critical cull). */
export function windowedPads(pads: readonly TrampolineSpec[], centerY: number): TrampolineSpec[] {
  return pads.filter(
    (t) => t.position[1] >= centerY - WINDOW_BELOW && t.position[1] <= centerY + WINDOW_ABOVE,
  );
}

/**
 * Renders the generated tower of trampolines from the world store as a BOUNDED sliding
 * window around the blob — pads far below (already fallen past) and far above (not yet
 * reached) are culled so the live pad count stays flat no matter how high you climb.
 * This keeps the per-frame render + Rapier-body + splat-canvas cost constant over a long
 * run (the unbounded list was the source of the climb-time frame hitch). Keyed by the
 * pad's stable id so culling reconciles instead of remounting survivors.
 */

interface TrampolineFieldProps {
  onImpact?: (id: number, speed: number) => void;
}

export function TrampolineField({ onImpact }: TrampolineFieldProps) {
  const trampolines = useWorldStore((s) => s.trampolines);
  const [centerY, setCenterY] = useState(0);
  const lastCenter = useRef(0);

  // Drive the window center off the blob's live Y, but only commit a new center (which
  // re-renders) when it has moved a full WINDOW_STEP — so we don't reconcile every frame.
  useFrame(() => {
    const y = getBlobDiagnostics().position[1];
    if (Math.abs(y - lastCenter.current) >= WINDOW_STEP) {
      lastCenter.current = y;
      setCenterY(y);
    }
  });

  const visible = useMemo(() => windowedPads(trampolines, centerY), [trampolines, centerY]);

  return (
    <>
      {visible.map((t) => (
        <Trampoline
          key={t.id}
          id={t.id}
          routeIndex={t.routeIndex}
          position={t.position}
          width={t.width}
          depth={t.depth}
          type={t.type}
          cant={t.cant}
          cantAngleRad={t.cantAngleRad}
          moveAxis={t.moveAxis}
          onImpact={(speed) => onImpact?.(t.id, speed)}
        />
      ))}
    </>
  );
}
