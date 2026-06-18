import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import type { Group } from "three";
import { createRng } from "@/core/math";
import { getBlobDiagnostics } from "@/state";
import { palette } from "@/styles/tokens";

/**
 * BiomeScenicProps - Renders beautiful low-poly decorative background elements (cactus,
 * tree, mushroom, and space rocks) scattered across the climb path.
 * As Blobby climbs, the props wrap continuously around the current altitude window
 * (matching the cloud/star wrap logic), and dynamically show/hide the appropriate model
 * based on the prop's wrapped altitude. This creates a dense, rich, and continuous biome
 * progression without any per-frame React state or re-render overhead!
 */
const PROP_COUNT = 14;
const COLUMN = 95; // vertical height window centered on the player

function wrapY(yFrac: number, h: number): number {
  const lowEdge = h - COLUMN / 2;
  const off = (((yFrac * COLUMN - lowEdge) % COLUMN) + COLUMN) % COLUMN;
  return lowEdge + off;
}

const url = (file: string) => `${import.meta.env.BASE_URL}assets/models/${file}`;

function CactusModel({ scale }: { scale: number }) {
  const { scene } = useGLTF(url("cactus.glb"));
  const model = useMemo(() => scene.clone(true), [scene]);
  return <primitive object={model} scale={scale} />;
}

function TreeModel({ scale }: { scale: number }) {
  const { scene } = useGLTF(url("tree.glb"));
  const model = useMemo(() => scene.clone(true), [scene]);
  return <primitive object={model} scale={scale} />;
}

function MushroomModel({ scale }: { scale: number }) {
  const { scene } = useGLTF(url("mushroom.glb"));
  const model = useMemo(() => scene.clone(true), [scene]);
  return <primitive object={model} scale={scale} />;
}

function RockModel({ scale }: { scale: number }) {
  const { scene } = useGLTF(url("rock.glb"));
  const model = useMemo(() => scene.clone(true), [scene]);
  return <primitive object={model} scale={scale} />;
}

interface PropSpec {
  id: number;
  x: number;
  z: number;
  yFrac: number;
  scale: number;
  rotY: number;
  rotSpeed: number;
  phase: number;
  bobAmplitude: number;
  bobSpeed: number;
}

function ScenicInstance({ spec }: { spec: PropSpec }) {
  const groupRef = useRef<Group>(null);
  const cactusRef = useRef<Group>(null);
  const treeRef = useRef<Group>(null);
  const mushRef = useRef<Group>(null);
  const rockRef = useRef<Group>(null);

  useFrame((state) => {
    const group = groupRef.current;
    if (!group) return;

    const h = getBlobDiagnostics().position[1];
    const t = state.clock.elapsedTime;

    const y = wrapY(spec.yFrac, h);

    // Continuous floating/bobbing animation
    const bob = Math.sin(t * spec.bobSpeed + spec.phase) * spec.bobAmplitude;
    group.position.set(spec.x, y + bob, spec.z);

    // Determine biome type based on the wrapped height
    let activeType: "cactus" | "tree" | "mushroom" | "rock" = "cactus";
    if (y < 160) {
      activeType = "cactus";
    } else if (y < 500) {
      activeType = "tree";
    } else if (y < 900) {
      activeType = "mushroom";
    } else {
      activeType = "rock";
    }

    // Set visibility of specific biome models
    if (cactusRef.current) cactusRef.current.visible = activeType === "cactus";
    if (treeRef.current) treeRef.current.visible = activeType === "tree";
    if (mushRef.current) mushRef.current.visible = activeType === "mushroom";
    if (rockRef.current) rockRef.current.visible = activeType === "rock";

    // Dynamic rotation
    group.rotation.y = spec.rotY + t * spec.rotSpeed;
    if (activeType === "rock") {
      // Space rocks tumble in multiple dimensions
      group.rotation.x = t * spec.rotSpeed * 0.5;
      group.rotation.z = t * spec.rotSpeed * 0.3;
    } else {
      group.rotation.x = 0;
      group.rotation.z = 0;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Cactus Biome (Lower dry/sandy levels) */}
      <group ref={cactusRef} visible={false}>
        <CactusModel scale={spec.scale * 1.3} />
        {/* Soft gold/warm cloud shelf beneath cactus */}
        <mesh position={[0, -0.15, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[2.0, 1.4, 1.0]}>
          <circleGeometry args={[1, 32]} />
          <meshBasicMaterial
            color={palette.cloud.warm}
            transparent
            opacity={0.28}
            depthWrite={false}
          />
        </mesh>
      </group>

      {/* Tree Biome (Lush middle levels) */}
      <group ref={treeRef} visible={false}>
        <TreeModel scale={spec.scale * 1.4} />
        {/* Soft fluffy pink/cream cloud shelf beneath tree */}
        <mesh position={[0, -0.15, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[2.4, 1.8, 1.0]}>
          <circleGeometry args={[1, 32]} />
          <meshBasicMaterial
            color={palette.cloud.puff}
            transparent
            opacity={0.3}
            depthWrite={false}
          />
        </mesh>
      </group>

      {/* Mushroom Biome (Fungal/mystical stratosphere levels) */}
      <group ref={mushRef} visible={false}>
        <MushroomModel scale={spec.scale * 1.3} />
        {/* Soft mystical blush/violet cloud shelf beneath mushroom */}
        <mesh position={[0, -0.1, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[2.0, 1.5, 1.0]}>
          <circleGeometry args={[1, 32]} />
          <meshBasicMaterial
            color={palette.cloud.blush}
            transparent
            opacity={0.28}
            depthWrite={false}
          />
        </mesh>
      </group>

      {/* Space Rock Biome (High cosmic/space levels) */}
      <group ref={rockRef} visible={false}>
        <RockModel scale={spec.scale * 1.6} />
        {/* Celestial ring/halo glowing instead of a cloud shelf */}
        <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.5, 1.8, 32]} />
          <meshBasicMaterial
            color={palette.cloud.glow}
            transparent
            opacity={0.32}
            depthWrite={false}
          />
        </mesh>
      </group>
    </group>
  );
}

export function BiomeScenicProps() {
  const specs = useMemo(() => {
    const rng = createRng(444);
    return Array.from({ length: PROP_COUNT }, (_, i) => ({
      id: i,
      x: rng.range(-22, 22),
      z: rng.range(-26, -10), // background depth layer (behind play field)
      yFrac: rng.next(),
      scale: rng.range(0.8, 1.3),
      rotY: rng.range(0, Math.PI * 2),
      rotSpeed: rng.range(0.15, 0.45) * rng.sign(),
      phase: rng.range(0, Math.PI * 2),
      bobAmplitude: rng.range(0.2, 0.5),
      bobSpeed: rng.range(0.6, 1.1),
    }));
  }, []);

  return (
    <>
      {specs.map((spec) => (
        <ScenicInstance key={spec.id} spec={spec} />
      ))}
    </>
  );
}

// Preload assets for stutter-free experience
if (!import.meta.env.VITEST) {
  useGLTF.preload(url("cactus.glb"));
  useGLTF.preload(url("tree.glb"));
  useGLTF.preload(url("mushroom.glb"));
  useGLTF.preload(url("rock.glb"));
}
