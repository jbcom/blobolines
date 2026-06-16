import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import { damp } from "@/core/math";
import { getBlobDiagnostics } from "@/state";

/**
 * Camera rig. In MENU it slowly orbits the hero blob; in PLAYING it FOLLOWS the live blob
 * — its real x/y/z from the diagnostics bridge, not just the height readout — so lateral
 * air-steering and arcs stay framed instead of flying the blob off-screen. Pulls back with
 * speed and adds a short decaying impact shake for game-feel.
 */
export function CameraRig({ active }: { active: boolean }) {
  const camera = useThree((s) => s.camera);
  const t = useRef(0);
  /** Decaying camera-shake amplitude, spiked on a hard landing. */
  const shake = useRef(0);
  /** Last impact level seen, to detect a fresh landing (squash dips below 1). */
  const lastImpact = useRef(0);

  useFrame((_, dt) => {
    t.current += dt;
    if (active) {
      const diag = getBlobDiagnostics();
      const [bx, by, bz] = diag.position;
      const speed = diag.speed;

      // Detect a fresh impact (squash drops) → kick the shake.
      const impact = 1 - diag.squash; // 0..~0.3
      if (impact > lastImpact.current + 0.04) shake.current = Math.min(1, impact * 3);
      lastImpact.current = impact;
      shake.current *= Math.exp(-dt / 0.12); // fast decay

      // Pull back a touch as the blob moves fast (sense of speed), framed slightly above.
      const pull = Math.min(speed / 26, 1);
      const camDist = 11 + pull * 4;
      const camLift = 6 + pull * 2;

      const k = damp(dt, 0.16);
      camera.position.x += (bx - camera.position.x) * k;
      camera.position.y += (by + camLift - camera.position.y) * k;
      camera.position.z += (bz + camDist - camera.position.z) * k;

      // Impact shake (decays in ~0.12s) — small, juicy, never disorienting.
      const s = shake.current * 0.5;
      camera.position.x += Math.sin(t.current * 90) * s;
      camera.position.y += Math.cos(t.current * 83) * s;

      // Look at the blob, biased a little upward (toward where it's headed).
      camera.lookAt(bx, by + 1.5, bz);
    } else {
      camera.position.x = Math.sin(t.current * 0.25) * 4;
      camera.position.z = Math.cos(t.current * 0.25) * 6 + 4;
      camera.position.y = 1 + Math.sin(t.current * 0.4) * 0.5;
      camera.lookAt(0, 0, 0);
    }
  });

  return null;
}
