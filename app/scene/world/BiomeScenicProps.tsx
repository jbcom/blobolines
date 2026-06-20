import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, useState } from "react";
import type { Group } from "three";
import {
  allBiomePropFiles,
  type BiomePropSet,
  biomePropRegistry,
  type ParallaxLayer,
  type PropShelf,
  parallaxLayers,
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
/** Continuous vertical wrap of an instance's home fraction into a `column`-tall window centred
 *  on the blob height — scrolls seamlessly with the climb. Taller columns scroll past slower,
 *  which is what makes a far parallax layer read as distant. */
function wrapY(yFrac: number, h: number, column: number): number {
  const lowEdge = h - column / 2;
  const off = (((yFrac * column - lowEdge) % column) + column) % column;
  return lowEdge + off;
}

const url = (file: string) => `${import.meta.env.BASE_URL}assets/models/${file}`;

/** Generic GLB prop. Clones the loaded scene so each instance is independent. When `opacity` is
 *  below 1 (far parallax layers read hazier), the cloned materials are made transparent so the
 *  layer recedes — materials are cloned too so this never mutates the shared cached GLB. */
function PropModel({ file, scale, opacity }: { file: string; scale: number; opacity: number }) {
  const { scene } = useGLTF(url(file));
  const model = useMemo(() => {
    const clone = scene.clone(true);
    if (opacity < 1) {
      clone.traverse((obj) => {
        const mesh = obj as { material?: MeshMaterial };
        if (mesh.material) {
          const m = mesh.material.clone();
          m.transparent = true;
          m.opacity = opacity;
          m.depthWrite = false;
          mesh.material = m;
        }
      });
    }
    return clone;
  }, [scene, opacity]);
  return <primitive object={model} scale={scale} />;
}

interface MeshMaterial {
  transparent: boolean;
  opacity: number;
  depthWrite: boolean;
  clone(): MeshMaterial;
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
  id: string;
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
  /** Sideways drift amplitude (px·multiplier) for this instance — scaled per parallax layer. */
  driftAmp: number;
  /** The parallax layer this instance belongs to (depth/drift/wrap behaviour). */
  layer: ParallaxLayer;
}

/** Pick the registry set for a band that actually has props, or null. */
function activeSet(band: string): BiomePropSet | null {
  const set = biomePropRegistry.find((s) => s.band === band);
  return set && set.props.length > 0 ? set : null;
}

/** One scenery instance. Mounts ONLY the current band's prop (not all six) and swaps it via
 *  React state when the wrapped altitude crosses into a new band — so the scene graph holds
 *  one model per instance instead of one per band. `useGLTF` caches the loaded GLBs, so a
 *  band crossing remounts from cache with no refetch. Band selection is `biomeBandAt` — the
 *  single source of truth. */
function ScenicInstance({ spec }: { spec: PropSpec }) {
  const groupRef = useRef<Group>(null);
  const [band, setBand] = useState(() => biomeBandAt(wrapY(spec.yFrac, 0, spec.layer.column)));

  useFrame((state) => {
    const group = groupRef.current;
    if (!group) return;

    const h = getBlobDiagnostics().position[1];
    const t = state.clock.elapsedTime;

    const y = wrapY(spec.yFrac, h, spec.layer.column);
    const nextBand = biomeBandAt(y);
    if (nextBand !== band) setBand(nextBand); // only re-renders on a band crossing (rare)

    // Continuous floating/bob + sideways parallax drift (faster on near layers, slow on far).
    const bob = Math.sin(t * spec.bobSpeed + spec.phase) * spec.bobAmplitude;
    const driftX = Math.sin(t * 0.18 + spec.phase) * spec.driftAmp;
    group.position.set(spec.x + driftX, y + bob, spec.z);

    // Cosmic bands tumble in 3D; atmospheric bands spin gently about Y only.
    group.rotation.y = spec.rotY + t * spec.rotSpeed;
    if (nextBand === "space" || nextBand === "deep-space") {
      group.rotation.x = t * spec.rotSpeed * 0.5;
      group.rotation.z = t * spec.rotSpeed * 0.3;
    } else {
      group.rotation.x = 0;
      group.rotation.z = 0;
    }
  });

  const set = activeSet(band);

  return (
    <group ref={groupRef}>
      {set && (
        <>
          <PropModel
            file={set.props[spec.pick[set.band] % set.props.length].file}
            scale={spec.scale * set.props[spec.pick[set.band] % set.props.length].scale}
            opacity={spec.layer.opacity}
          />
          {/* Only the mid layer plants a shelf; far silhouettes + near accents float free. */}
          {spec.layer.id === "mid" && <Shelf shelf={set.shelf} />}
        </>
      )}
    </group>
  );
}

/** Deterministic per-layer seeds so adding/removing one parallax layer never reshuffles the
 *  others (each layer draws from its own RNG streams, by index). */
const LAYER_SEED: Record<ParallaxLayer["id"], number> = { far: 440, mid: 444, near: 448 };

export function BiomeScenicProps() {
  const specs = useMemo<PropSpec[]>(() => {
    const out: PropSpec[] = [];
    for (const layer of parallaxLayers) {
      // Two independent streams per layer: layout (placement/animation) and pick (per-band model
      // choice) — so a band addition never shifts a layer's layout, and layers stay independent.
      const layoutRng = createRng(LAYER_SEED[layer.id]);
      const pickRng = createRng(LAYER_SEED[layer.id] + 1);
      for (let i = 0; i < layer.count; i++) {
        const spec: PropSpec = {
          id: `${layer.id}-${i}`,
          x: layoutRng.range(-24, 24),
          z: layoutRng.range(layer.zRange[0], layer.zRange[1]),
          yFrac: layoutRng.next(),
          scale: layoutRng.range(0.8, 1.3) * layer.scale,
          rotY: layoutRng.range(0, Math.PI * 2),
          rotSpeed: layoutRng.range(0.15, 0.45) * layoutRng.sign(),
          phase: layoutRng.range(0, Math.PI * 2),
          bobAmplitude: layoutRng.range(0.2, 0.5),
          bobSpeed: layoutRng.range(0.6, 1.1),
          driftAmp: layoutRng.range(1.5, 3) * layer.driftScale,
          pick: {},
          layer,
        };
        for (const set of biomePropRegistry) {
          spec.pick[set.band] =
            set.props.length > 0 ? Math.floor(pickRng.next() * set.props.length) : 0;
        }
        out.push(spec);
      }
    }
    return out;
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
