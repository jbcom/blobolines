import { FixtureStage } from "@app/fixtures";
import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import type { Object3D } from "three";
import { afterEach, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { setBlobDiagnostics, useWorldStore } from "@/state";
import { TreasureChests } from "../TreasureChests";

afterEach(() => {
  useWorldStore.setState({ crystals: [], seed: 1, seedPhrase: "seed-1", runId: 0 });
});

function CaptureScene({ onScene }: { onScene: (root: Object3D) => void }) {
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    onScene(scene);
  }, [scene, onScene]);
  return null;
}

function visibleMeshCount(root: Object3D): number {
  let n = 0;
  root.traverse((o) => {
    if ((o as { isMesh?: boolean }).isMesh) {
      let visible = o.visible;
      let p: Object3D | null = o.parent;
      while (visible && p) {
        visible = p.visible;
        p = p.parent;
      }
      if (visible) n++;
    }
  });
  return n;
}

// A treasure-tier crystal near the blob mounts a chest GLB (visible mesh); non-treasure tiers
// do not. Proves the chest pool follows treasure positions and stays hidden otherwise.
test("TreasureChests shows a chest only for a treasure-tier crystal in range", async () => {
  useWorldStore.setState({ crystals: [{ position: [0, 5, 0], tier: "treasure" }] });
  setBlobDiagnostics({
    position: [0, 5, 0],
    velocity: [0, 0, 0],
    speed: 0,
    airborne: true,
    expression: "idle",
    squash: 1,
    maxHeight: 5,
    groundY: 0,
  });

  let root: Object3D | null = null;
  const screen = await render(
    <FixtureStage testId="treasure-fixture" cameraDistance={8}>
      <ambientLight intensity={1} />
      <CaptureScene onScene={(s) => (root = s)} />
      <TreasureChests />
    </FixtureStage>,
  );
  await expect.element(screen.getByTestId("treasure-fixture")).toBeInTheDocument();

  // The chest GLB streams in + a useFrame seats it; wait for a visible chest mesh to appear.
  await vi.waitFor(
    () => {
      expect(root).not.toBeNull();
      expect(visibleMeshCount(root as unknown as Object3D)).toBeGreaterThan(0);
    },
    { timeout: 10000, interval: 100 },
  );

  // Swap the crystal to a non-treasure tier — the chest pool should hide all chests.
  useWorldStore.setState({ crystals: [{ position: [0, 5, 0], tier: "radiant" }] });
  await vi.waitFor(
    () => {
      expect(visibleMeshCount(root as unknown as Object3D)).toBe(0);
    },
    { timeout: 4000, interval: 100 },
  );
});
