import { useEffect, useRef } from "react";
import { keyboardSteer } from "@/input";
import { getBlobDiagnostics, setAirSteer } from "@/state";

/**
 * Desktop keyboard air-steering: WASD / arrow keys → lateral air-steer while the blob is
 * airborne (the secondary control to the primary touch/mouse drag — mobile-first, keyboard is
 * a convenience for desktop). Wires the pure `keyboardSteer` intent math (src/input) that was
 * previously built-but-unplugged.
 *
 * Writes the steer accel imperatively into the input bridge (the same channel LaunchInput's
 * drag uses) only while keys are held; releasing all keys clears it. Gated to PLAYING — mount
 * this only while the game is active so menu typing never moves the blob. It checks `airborne`
 * each keypress so holding a key on a resting blob is inert (matches the drag behavior).
 */
export function useKeyboardSteer() {
  // Live held-key state; a ref (not state) so the listeners don't re-bind on every keypress.
  const keys = useRef({ left: false, right: false, up: false, down: false });

  useEffect(() => {
    // Map both WASD and the arrow keys to the four directions. Returns false for any other key
    // so we don't preventDefault / swallow unrelated input.
    const dir = (code: string): keyof typeof keys.current | null => {
      switch (code) {
        case "ArrowLeft":
        case "KeyA":
          return "left";
        case "ArrowRight":
        case "KeyD":
          return "right";
        case "ArrowUp":
        case "KeyW":
          return "up";
        case "ArrowDown":
        case "KeyS":
          return "down";
        default:
          return null;
      }
    };

    /** Recompute the steer from the current held keys and publish it (clears to [0,0] when none
     *  are held, or when the blob isn't airborne — steering only applies in flight). */
    const publish = () => {
      const airborne = getBlobDiagnostics().airborne;
      if (!airborne) {
        setAirSteer(0, 0);
        return;
      }
      const [x, z] = keyboardSteer(keys.current);
      setAirSteer(x, z);
    };

    const onDown = (e: KeyboardEvent) => {
      const k = dir(e.code);
      if (!k || e.repeat) return; // ignore auto-repeat (held-state already true)
      e.preventDefault(); // stop arrow keys from scrolling the page
      keys.current[k] = true;
      publish();
    };
    const onUp = (e: KeyboardEvent) => {
      const k = dir(e.code);
      if (!k) return;
      keys.current[k] = false;
      publish();
    };
    // If the window loses focus mid-hold, the keyup may never arrive — clear so the blob doesn't
    // drift forever on a stuck key.
    const onBlur = () => {
      keys.current = { left: false, right: false, up: false, down: false };
      setAirSteer(0, 0);
    };

    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", onBlur);
      setAirSteer(0, 0); // don't leave a steer force pending when unmounting (run end)
    };
  }, []);
}
