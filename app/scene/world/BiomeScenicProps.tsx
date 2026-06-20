import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import type { Group } from "three";
import {
  allBiomePropFiles,
  type BiomePropSet,
  biomePropRegistry,
  type PropShelf,
} from "@/config/biomeProps";
import { biomeBandAt } from "@/config/biomes";
import { createRng } from "@/core/math";
import { getBlobDiagnostics } from "@/state";

/**
 * BiomeScenicProps — data-driven low-poly scenery scattered across the climb. Each prop
 * instance wraps continuously around the current altitude window (matching cloud/star wrap)
 * and, based on the wrapped altitude's canonical biome band (`biomeBandAt`), shows one prop
 * from that band's curated set (see `biomePropRegistry`). All band sets are mounted up front
 * and toggled by visibility — no per-frame React state, no re-render overhead — so the biome
 * progression reads dense and continuous as Blobby climbs.
 *
 * Adding props or a band is a pure data edit in `src/config/biomeProps.ts`; this component
 * carries no band thresholds or hardcoded model list of its own.
 */
const PROP_COUNT = 16;
const COLUMN = 95; // vertical height window centered on the player

function wrapY(yFrac: number, h: number): number {
  const lowEdge = h - COLUMN / 2;
  const off = (((yFrac * COLUMN - lowEdge) % COLUMN) + COLUMN) % COLUMN;
  return lowEdge + off;
}

const url = (file: string) => `${import.meta.env.BASE_URL}assets/models/${file}`;

/** Generic GLB prop. Clones the loaded scene so each instance is independent. */
function PropModel({ file, scale }: { file: string; scale: number }) {
  const { scene } = useGLTF(url(file));
  const model = useMemo(() => scene.clone(true), [scene]);
  return <primitive object={model} scale={scale} />;
}

/** Soft decorative seat beneath a prop — a translucent disc on atmospheric bands or a
 *  glowing celestial ring in the airless cosmic bands. */
function Shelf({ shelf }: { shelf: PropShelf }) {
  if (shelf.kind === "ring") {
    return (
      <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.5, 1.8, 32]} />
        <meshBasicMaterial
          color={shelf.color}
          transparent
          opacity={shelf.opacity}
          depthWrite={false}
        />
      </mesh>
    );
  }
  const [sx, sy] = shelf.scale ?? [2.0, 1.5];
  return (
    <mesh position={[0, -0.15, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[sx, sy, 1.0]}>
      <circleGeometry args={[1, 32]} />
      <meshBasicMaterial
        color={shelf.color}
        transparent
        opacity={shelf.opacity}
        depthWrite={false}
      />
    </mesh>
  );
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
  /** Per-band index into that band's prop set (which specific model this instance shows). */
  pick: Record<string, number>;
  bobSpeed: number;
}

/** One scenery instance: mounts every band's chosen prop, shows the one for the current
 *  wrapped altitude's band. Band selection is `biomeBandAt` — the single source of truth. */
function ScenicInstance({ spec }: { spec: PropSpec }) {
  const groupRef = useRef<Group>(null);
  // One band-group ref per registry band, keyed by band name.
  const bandRefs = useRef<Record<string, Group | null>>({});

  useFrame((state) => {
    const group = groupRef.current;
    if (!group) return;

    const h = getBlobDiagnostics().position[1];
    const t = state.clock.elapsedTime;

    const y = wrapY(spec.yFrac, h);
    const activeBand = biomeBandAt(y);

    // Continuous floating/bobbing animation.
    const bob = Math.sin(t * spec.bobSpeed + spec.phase) * spec.bobAmplitude;
    group.position.set(spec.x, y + bob, spec.z);

    // Show only the active band's prop group.
    for (const set of biomePropRegistry) {
      const ref = bandRefs.current[set.band];
      if (ref) ref.visible = set.band === activeBand;
    }

    // Cosmic bands tumble in 3D; atmospheric bands spin gently about Y only.
    group.rotation.y = spec.rotY + t * spec.rotSpeed;
    if (activeBand === "space" || activeBand === "deep-space") {
      group.rotation.x = t * spec.rotSpeed * 0.5;
      group.rotation.z = t * spec.rotSpeed * 0.3;
    } else {
      group.rotation.x = 0;
      group.rotation.z = 0;
    }
  });

  return (
    <group ref={groupRef}>
      {biomePropRegistry.map((set: BiomePropSet) => {
        if (set.props.length === 0) return null;
        const prop = set.props[spec.pick[set.band] % set.props.length];
        return (
          <group
            key={set.band}
            ref={(g) => {
              bandRefs.current[set.band] = g;
            }}
            visible={false}
          >
            <PropModel file={prop.file} scale={spec.scale * prop.scale} />
            <Shelf shelf={set.shelf} />
          </group>
        );
      })}
    </group>
  );
}

export function BiomeScenicProps() {
  const specs = useMemo<PropSpec[]>(() => {
    const rng = createRng(444);
    return Array.from({ length: PROP_COUNT }, (_, i) => {
      // Deterministic per-band model pick for this instance.
      const pick: Record<string, number> = {};
      for (const set of biomePropRegistry) {
        pick[set.band] = set.props.length > 0 ? Math.floor(rng.next() * set.props.length) : 0;
      }
      return {
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
        pick,
      };
    });
  }, []);

  return (
    <>
      {specs.map((spec) => (
        <ScenicInstance key={spec.id} spec={spec} />
      ))}
    </>
  );
}

// Preload every registry prop for stutter-free band transitions.
if (!import.meta.env.VITEST) {
  for (const file of allBiomePropFiles) {
    useGLTF.preload(url(file));
  }
}
