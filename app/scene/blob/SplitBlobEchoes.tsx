import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import type { Group } from "three";
import { AdditiveBlending, MeshBasicMaterial } from "three";
import type { BlobSkin } from "@/core/types";
import { consumeBlobSplits } from "@/state";
import { palette } from "@/styles/tokens";

interface Fragment {
  active: boolean;
  age: number;
  life: number;
  position: [number, number, number];
  origin: readonly [number, number, number];
  velocity: [number, number, number];
  radius: number;
  phase: number;
}

const POOL = 12;
const GRAVITY_Y = -18;

function lateralAxis(normal: readonly [number, number, number]): [number, number, number] {
  const x = -normal[2];
  const z = normal[0];
  const m = Math.hypot(x, z);
  return m < 1e-6 ? [1, 0, 0] : [x / m, 0, z / m];
}

export function SplitBlobEchoes({ skin }: { skin: BlobSkin }) {
  const refs = useRef<(Group | null)[]>(Array(POOL).fill(null));
  const fragments = useRef<Fragment[]>(
    Array.from({ length: POOL }, () => ({
      active: false,
      age: Number.POSITIVE_INFINITY,
      life: 1.18,
      position: [0, -999, 0],
      origin: [0, -999, 0],
      velocity: [0, 0, 0],
      radius: 0.28,
      phase: 0,
    })),
  );
  const head = useRef(0);
  const gooMat = useMemo<MeshBasicMaterial>(
    () =>
      new MeshBasicMaterial({
        color: palette.blob[skin],
        transparent: true,
        opacity: 0.82,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    [skin],
  );
  const eyeMat = useMemo<MeshBasicMaterial>(
    () => new MeshBasicMaterial({ color: palette.eye.sclera, depthWrite: false }),
    [],
  );
  const pupilMat = useMemo<MeshBasicMaterial>(
    () => new MeshBasicMaterial({ color: palette.eye.pupil, depthWrite: false }),
    [],
  );

  useEffect(() => () => gooMat.dispose(), [gooMat]);
  useEffect(() => () => eyeMat.dispose(), [eyeMat]);
  useEffect(() => () => pupilMat.dispose(), [pupilMat]);

  useFrame((state, dt) => {
    for (const split of consumeBlobSplits()) {
      const count = Math.max(3, Math.min(5, Math.round(split.count)));
      const lateral = lateralAxis(split.normal);
      for (let i = 0; i < count; i++) {
        const idx = head.current;
        head.current = (head.current + 1) % POOL;
        const fragment = fragments.current[idx];
        const centered = i - (count - 1) / 2;
        const spread = centered * split.spread;
        fragment.active = true;
        fragment.age = 0;
        fragment.life = 1.08 + Math.abs(centered) * 0.08;
        fragment.origin = split.position;
        fragment.velocity = [
          split.velocity[0] * 0.62 + lateral[0] * spread,
          Math.max(4, split.velocity[1] * 0.38 + 5.2 - Math.abs(centered) * 0.45),
          split.velocity[2] * 0.62 + lateral[2] * spread,
        ];
        fragment.radius = 0.24 + split.strength * 0.08 + (i % 2) * 0.025;
        fragment.phase = state.clock.elapsedTime + i * 1.7;
      }
    }

    for (let i = 0; i < POOL; i++) {
      const fragment = fragments.current[i];
      const group = refs.current[i];
      if (!group) continue;
      if (!fragment.active) {
        group.visible = false;
        continue;
      }
      fragment.age += dt;
      const t = fragment.age;
      const life = Math.max(0, 1 - t / fragment.life);
      if (life <= 0) {
        fragment.active = false;
        group.visible = false;
        continue;
      }
      const [ox, oy, oz] = fragment.origin;
      const [vx, vy, vz] = fragment.velocity;
      fragment.position = [ox + vx * t, oy + vy * t + 0.5 * GRAVITY_Y * t * t, oz + vz * t];
      const wobble = 1 + Math.sin(state.clock.elapsedTime * 12 + fragment.phase) * 0.13 * life;
      group.position.set(...fragment.position);
      group.scale.set(
        fragment.radius * wobble,
        fragment.radius * (1.25 - life * 0.2),
        fragment.radius / wobble,
      );
      group.visible = true;
    }
  });

  return (
    <group renderOrder={38}>
      {Array.from({ length: POOL }, (_, i) => (
        <group
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed visual pool
          key={i}
          ref={(node) => {
            refs.current[i] = node;
          }}
          visible={false}
        >
          <mesh material={gooMat} renderOrder={38}>
            <sphereGeometry args={[1, 18, 14]} />
          </mesh>
          <mesh
            material={eyeMat}
            position={[-0.34, 0.14, 0.82]}
            scale={[0.22, 0.28, 0.08]}
            renderOrder={39}
          >
            <sphereGeometry args={[1, 10, 8]} />
          </mesh>
          <mesh
            material={eyeMat}
            position={[0.34, 0.14, 0.82]}
            scale={[0.22, 0.28, 0.08]}
            renderOrder={39}
          >
            <sphereGeometry args={[1, 10, 8]} />
          </mesh>
          <mesh
            material={pupilMat}
            position={[-0.34, 0.12, 0.9]}
            scale={[0.08, 0.11, 0.03]}
            renderOrder={40}
          >
            <sphereGeometry args={[1, 8, 6]} />
          </mesh>
          <mesh
            material={pupilMat}
            position={[0.34, 0.12, 0.9]}
            scale={[0.08, 0.11, 0.03]}
            renderOrder={40}
          >
            <sphereGeometry args={[1, 8, 6]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
