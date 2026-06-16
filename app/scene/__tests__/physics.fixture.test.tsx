import { FixtureStage } from "@app/fixtures";
import { Physics, RigidBody } from "@react-three/rapier";
import { useEffect, useRef } from "react";
import { expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";

/**
 * Regression for the Rapier-WASM suspension bug: if @react-three/rapier is pre-bundled
 * by Vite, its WASM init never resolves and <Physics> children never mount (no error,
 * just a forever-suspended tree). This renders a real Physics body in a headless WebGL
 * context and asserts it actually FALLS under gravity — which only happens once the WASM
 * init resolves and the body simulates. Fails (times out) if Physics suspends.
 */

function FallingProbe({ onTick }: { onTick: (y: number) => void }) {
  const ref = useRef<import("@react-three/rapier").RapierRigidBody>(null);
  useEffect(() => {
    const id = setInterval(() => {
      const y = ref.current?.translation().y;
      if (typeof y === "number") onTick(y);
    }, 50);
    return () => clearInterval(id);
  }, [onTick]);
  return (
    <RigidBody ref={ref} position={[0, 5, 0]} colliders="ball">
      <mesh>
        <sphereGeometry args={[0.5]} />
        <meshStandardMaterial />
      </mesh>
    </RigidBody>
  );
}

function PhysicsScene({ onTick }: { onTick: (y: number) => void }) {
  return (
    <FixtureStage testId="physics-fixture" cameraDistance={12}>
      <Physics gravity={[0, -22, 0]}>
        <FallingProbe onTick={onTick} />
      </Physics>
    </FixtureStage>
  );
}

test("Rapier Physics mounts and a body simulates under gravity", async () => {
  let minY = Number.POSITIVE_INFINITY;
  let firstY = Number.NaN;
  const onTick = (y: number) => {
    if (Number.isNaN(firstY)) firstY = y;
    minY = Math.min(minY, y);
  };

  const screen = await render(<PhysicsScene onTick={onTick} />);
  await expect.element(screen.getByTestId("physics-fixture")).toBeInTheDocument();

  // The body must fall — proving WASM init resolved and the sim steps.
  await vi.waitFor(
    () => {
      expect(Number.isNaN(firstY)).toBe(false);
      expect(minY).toBeLessThan(4.5);
    },
    { timeout: 8000, interval: 100 },
  );
});
