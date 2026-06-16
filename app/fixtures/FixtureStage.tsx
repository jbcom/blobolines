import { Canvas } from "@react-three/fiber";
import type { ReactNode } from "react";
import { Lighting } from "@app/scene/world";

interface FixtureStageProps {
  children: ReactNode;
  /** Camera distance from origin. */
  cameraDistance?: number;
  /** data-testid for the wrapper, used by browser fixture tests. */
  testId?: string;
}

/**
 * Isolated R3F render stage for visual/fixture tests. Renders children in a Canvas
 * with neutral lighting and a fixed camera so individual scene components (blob,
 * trampoline, vfx) can be screenshotted deterministically.
 */
export function FixtureStage({
  children,
  cameraDistance = 8,
  testId = "fixture-stage",
}: FixtureStageProps) {
  return (
    <div data-testid={testId} style={{ width: 414, height: 414 }}>
      <Canvas
        camera={{ position: [0, 0, cameraDistance], fov: 50, near: 0.1, far: 200 }}
        gl={{ antialias: true, preserveDrawingBuffer: true }}
      >
        <Lighting />
        {children}
      </Canvas>
    </div>
  );
}
