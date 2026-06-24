import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { advance, createStepLoop } from "@/engine";

/**
 * Drives a deterministic fixed-timestep sim step from R3F's variable render loop. Render
 * frames vary (30–144 Hz); this feeds the wall delta into the engine accumulator
 * (src/engine/loop), which calls `step(FIXED_DT)` zero or more times so springs, particle
 * aging, and the height-chase advance reproducibly regardless of frame rate.
 *
 * `step(dt)` runs at the fixed rate (use for sim state). `interpolate(alpha)` runs once per
 * render frame with the [0,1) fraction toward the next step (use for render-only smoothing).
 * This is the engine.tick(dt) seam ARCHITECTURE.md describes; consumers (droplet system,
 * cloud-pad springs, render bridges) hang off it instead of each reimplementing a dt clamp.
 *
 * @param priority optional useFrame priority (e.g. to run before the postprocessing pass).
 */
export function useGameLoop(
  step: (dt: number) => void,
  interpolate?: (alpha: number) => void,
  priority = 0,
): void {
  const loop = useRef(createStepLoop());
  const stepRef = useRef(step);
  const interpRef = useRef(interpolate);
  stepRef.current = step;
  interpRef.current = interpolate;

  useFrame((_, dt) => {
    advance(loop.current, dt, (fixedDt) => stepRef.current(fixedDt));
    interpRef.current?.(loop.current.alpha);
  }, priority);
}
