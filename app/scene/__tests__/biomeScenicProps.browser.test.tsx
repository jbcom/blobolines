import { FixtureStage } from "@app/fixtures";
import { BiomeProps, BiomeScenicProps } from "@app/scene/world";
import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import { type Group, type Object3D, Vector3 } from "three";
import { expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { biomePropRegistry } from "@/config/biomeProps";
import { biomeBands } from "@/config/biomes";
import { setBlobDiagnostics } from "@/state";

/**
 * Render smoke test for the data-driven BiomeScenicProps: mounting it in a real WebGL
 * context must load the registry GLBs and build one prop group per canonical band. We then
 * drive the blob through every band altitude and assert that, once meshes have loaded, the
 * number of VISIBLE meshes is non-zero — i.e. the active band's prop is shown and the
 * GLBs actually resolved (a missing/broken GLB would leave an empty, invisible tree).
 */

function CaptureScene({ onScene }: { onScene: (root: Object3D) => void }) {
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    onScene(scene);
  }, [scene, onScene]);
  return null;
}

function setAltitude(y: number) {
  setBlobDiagnostics({
    position: [0, y, 0],
    velocity: [0, 0, 0],
    speed: 0,
    airborne: true,
    expression: "idle",
    squash: 1,
    maxHeight: y,
    groundY: 0,
  });
}

function countVisibleMeshes(root: Object3D): number {
  let n = 0;
  root.traverse((o: Object3D) => {
    // A mesh is effectively visible only if it and all ancestors are visible.
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

test("BiomeScenicProps mounts and shows registry props across every biome band", async () => {
  let sceneRoot: Group | null = null;
  setAltitude(0);

  const screen = await render(
    <FixtureStage testId="biome-scenic-fixture" cameraDistance={30}>
      <CaptureScene onScene={(s) => (sceneRoot = s as Group)} />
      <BiomeScenicProps />
    </FixtureStage>,
  );
  await expect.element(screen.getByTestId("biome-scenic-fixture")).toBeInTheDocument();

  // Wait for the async GLB loads to resolve and produce visible meshes at the ground band.
  await vi.waitFor(
    () => {
      expect(sceneRoot).not.toBeNull();
      expect(countVisibleMeshes(sceneRoot as unknown as Object3D)).toBeGreaterThan(0);
    },
    { timeout: 10000, interval: 100 },
  );

  // Every canonical band, driven by a representative altitude, must show some prop mesh
  // (props + shelf), confirming the registry resolved a prop for each band.
  for (const band of biomeBands) {
    const set = biomePropRegistry.find((s) => s.band === band.name);
    if (!set || set.props.length === 0) continue;
    setAltitude(band.minHeight + 1);
    await vi.waitFor(
      () => {
        expect(
          countVisibleMeshes(sceneRoot as unknown as Object3D),
          `${band.name} band should show a prop`,
        ).toBeGreaterThan(0);
      },
      { timeout: 4000, interval: 100 },
    );
  }
});

test("BiomeScenicProps renders props across multiple parallax depth layers", async () => {
  let sceneRoot: Group | null = null;
  setAltitude(50);

  const screen = await render(
    <FixtureStage testId="parallax-fixture" cameraDistance={40}>
      <CaptureScene onScene={(s) => (sceneRoot = s as Group)} />
      <BiomeScenicProps />
    </FixtureStage>,
  );
  await expect.element(screen.getByTestId("parallax-fixture")).toBeInTheDocument();

  // Collect the world-Z of every visible prop mesh; the far/mid/near layers place props in
  // distinct z-bands (≈ -62..-42 / -26..-10 / -6..1), so the spread of z positions must be wide.
  await vi.waitFor(
    () => {
      const root = sceneRoot as unknown as Object3D | null;
      expect(root).not.toBeNull();
      const zs: number[] = [];
      (root as Object3D).traverse((o: Object3D) => {
        if ((o as { isMesh?: boolean }).isMesh) {
          o.getWorldPosition(_tmp);
          zs.push(_tmp.z);
        }
      });
      expect(zs.length).toBeGreaterThan(3);
      // Assert explicit presence in distinct depth bands so a regression that drops ONE layer
      // fails deterministically (a wide span alone could pass with a single stretched layer).
      // Far props sit at z ≲ -40, near props at z ≳ -8 — require at least one of each.
      expect(
        zs.some((z) => z < -38),
        "expected a far-layer prop (z ≲ -40)",
      ).toBe(true);
      expect(
        zs.some((z) => z > -10),
        "expected a near-layer prop (z ≳ -8)",
      ).toBe(true);
    },
    { timeout: 10000, interval: 100 },
  );
});

test("a near-layer prop reacts (leans/pops) when the blob rushes past it", async () => {
  let sceneRoot: Group | null = null;
  setAltitude(50);

  const screen = await render(
    <FixtureStage testId="reactive-fixture" cameraDistance={40}>
      <CaptureScene onScene={(s) => (sceneRoot = s as Group)} />
      <BiomeScenicProps />
    </FixtureStage>,
  );
  await expect.element(screen.getByTestId("reactive-fixture")).toBeInTheDocument();

  // Near-layer prop groups are tagged renderOrder === 2 (mid 0 / far 1 / near 2).
  const nearGroups = () => {
    const out: Object3D[] = [];
    (sceneRoot as unknown as Object3D | null)?.traverse((o: Object3D) => {
      if (o.renderOrder === 2) out.push(o);
    });
    return out;
  };

  // Wait for the GLBs to load + near groups to exist, then aim the blob at one of them.
  await vi.waitFor(
    () => {
      expect(nearGroups().length).toBeGreaterThan(0);
    },
    { timeout: 10000, interval: 100 },
  );

  // Park the blob at a near prop's live world X/Y with a high velocity → the reaction should
  // ease the prop's rotation.z (lean) and scale (pop) away from rest over the next frames.
  const target = nearGroups()[0];
  target.getWorldPosition(_tmp);
  setBlobDiagnostics({
    position: [_tmp.x + 0.5, _tmp.y, 0],
    velocity: [0, 40, 0], // fast flyby → full-strength shove
    speed: 40,
    airborne: true,
    expression: "idle",
    squash: 1,
    maxHeight: _tmp.y,
    groundY: 0,
  });

  await vi.waitFor(
    () => {
      // SOME near prop must have leaned or popped away from rest (eased over a few frames).
      const reacted = nearGroups().some(
        (g) => Math.abs(g.rotation.z) > 1e-3 || Math.abs(g.scale.x - 1) > 1e-3,
      );
      expect(reacted, "a near prop should lean/pop toward the rushing blob").toBe(true);
    },
    { timeout: 4000, interval: 80 },
  );
});

test("a near prop FLYBY PULSE spikes its scale as the blob passes closest", async () => {
  let sceneRoot: Group | null = null;
  setAltitude(50);

  const screen = await render(
    <FixtureStage testId="pulse-fixture" cameraDistance={40}>
      <CaptureScene onScene={(s) => (sceneRoot = s as Group)} />
      <BiomeScenicProps />
    </FixtureStage>,
  );
  await expect.element(screen.getByTestId("pulse-fixture")).toBeInTheDocument();

  const nearGroups = () => {
    const out: Object3D[] = [];
    (sceneRoot as unknown as Object3D | null)?.traverse((o: Object3D) => {
      if (o.renderOrder === 2) out.push(o);
    });
    return out;
  };

  await vi.waitFor(() => expect(nearGroups().length).toBeGreaterThan(0), {
    timeout: 10000,
    interval: 100,
  });

  const target = nearGroups()[0];
  target.getWorldPosition(_tmp);
  const propX = _tmp.x;
  const propY = _tmp.y;

  // Drive the blob through the prop: BELOW it (approaching), AT it (closest = peak), then ABOVE
  // it (receding). The rising→falling influence edge must fire the pulse, spiking the scale beyond
  // the steady proximity pop. We sample the peak scale across the pass.
  let peakScale = 1;
  const sweep = [-3, -1.5, -0.5, 0, 0.5, 1.5, 3]; // Y offsets from the prop, low → high
  for (const off of sweep) {
    setBlobDiagnostics({
      position: [propX + 0.4, propY + off, 0],
      velocity: [0, 40, 0],
      speed: 40,
      airborne: true,
      expression: "idle",
      squash: 1,
      maxHeight: propY,
      groundY: 0,
    });
    // Let a few frames advance so the envelope steps.
    await new Promise((r) => setTimeout(r, 60));
    peakScale = Math.max(peakScale, target.scale.x);
  }

  // The flyby pulse adds up to ~0.16 on top of the ≤0.12 proximity pop, so a real pulse drives the
  // scale clearly past what proximity alone (≤1.12) could reach.
  expect(peakScale, "the flyby pulse should spike the prop's scale past its steady pop").toBeGreaterThan(
    1.13,
  );
});

const _tmp = new Vector3();

test("BiomeProps mounts and resolves ambience across every band without throwing", async () => {
  // The per-band ambience lookup throws on a missing band; driving the blob through every
  // band altitude in a live render proves the BiomeProps per-frame loop resolves ambience
  // for all of them (and that the mote layer mounts without error).
  setAltitude(0);
  const screen = await render(
    <FixtureStage testId="biome-props-fixture" cameraDistance={40}>
      <BiomeProps />
    </FixtureStage>,
  );
  await expect.element(screen.getByTestId("biome-props-fixture")).toBeInTheDocument();

  for (const band of biomeBands) {
    setAltitude(band.minHeight + 1);
    // Let a few frames run at this altitude so the useFrame ambience lookup executes.
    await new Promise((r) => setTimeout(r, 80));
    await expect.element(screen.getByTestId("biome-props-fixture")).toBeInTheDocument();
  }
});
