import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import { damp } from "@/core/math";
import { useGameStore } from "@/state";

/**
 * Camera rig. In MENU it slowly orbits the hero blob; in PLAYING it tracks the blob's
 * height (the climb), easing upward and pulling back slightly with vertical speed —
 * keeping the core-goal (how high) always framed. Adapted from arcade-cabinet camera
 * follow patterns (will-it-blow / marmalade-drops lerp rigs).
 */
export function CameraRig({ active }: { active: boolean }) {
  const camera = useThree((s) => s.camera);
  const targetY = useRef(5);
  const t = useRef(0);

  useFrame((_, dt) => {
    t.current += dt;
    if (active) {
      const height = useGameStore.getState().run.height;
      targetY.current = height + 4;
      const k = damp(dt, 0.18);
      camera.position.y += (height + 7.5 - camera.position.y) * k;
      camera.position.x += (0 - camera.position.x) * k;
      camera.position.z += (12 - camera.position.z) * k;
      camera.lookAt(0, targetY.current - 2, 0);
    } else {
      camera.position.x = Math.sin(t.current * 0.25) * 4;
      camera.position.z = Math.cos(t.current * 0.25) * 6 + 4;
      camera.position.y = 1 + Math.sin(t.current * 0.4) * 0.5;
      camera.lookAt(0, 0, 0);
    }
  });

  return null;
}
