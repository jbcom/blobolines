import { useFrame } from "@react-three/fiber";
import { BallCollider, type RapierRigidBody, RigidBody } from "@react-three/rapier";
import { useRef } from "react";
import { createRng, type Rng } from "@/core/math";
import type { BlobSkin } from "@/core/types";
import { consumeSplats } from "@/state";
import { hex, palette } from "@/styles/tokens";

/**
 * Real-physics goo chunks. On a hard landing the blob reports a splat burst (via the
 * bridge); this drains the queue and flings a few small Rapier rigid bodies from the
 * contact point that actually bounce/roll/settle on the pads under gravity, then sink/
 * recycle. A fixed pool (no per-spawn allocation, no body churn) — the oldest chunk is
 * reused when the pool wraps. This is the PHYSICAL mess; the metaball droplets are the
 * separate visual goo-merge.
 */
const POOL = 24;
const CHUNKS_PER_BURST = 6;
const CHUNK_LIFE = 2.4; // seconds before a chunk recycles (sink + fade out of play)
const RADIUS = 0.16;

export function SplatChunks({ skin }: { skin: BlobSkin }) {
  const bodies = useRef<(RapierRigidBody | null)[]>(Array(POOL).fill(null));
  const age = useRef<number[]>(Array(POOL).fill(Number.POSITIVE_INFINITY));
  const head = useRef(0);
  const rng = useRef<Rng>(createRng(7));

  useFrame((_, dt) => {
    // Age + sink finished chunks far below (out of play) so the pool can reuse them.
    for (let i = 0; i < POOL; i++) {
      age.current[i] += dt;
      if (age.current[i] > CHUNK_LIFE && bodies.current[i]) {
        const b = bodies.current[i];
        const t = b?.translation();
        if (b && t && t.y > -500) {
          b.setTranslation({ x: t.x, y: -1000, z: t.z }, false);
          b.setLinvel({ x: 0, y: 0, z: 0 }, false);
          b.sleep();
        }
      }
    }

    // Spawn chunks for each pending burst.
    for (const burst of consumeSplats()) {
      const n = Math.max(2, Math.round(CHUNKS_PER_BURST * burst.strength));
      for (let k = 0; k < n; k++) {
        const b = bodies.current[head.current];
        head.current = (head.current + 1) % POOL;
        if (!b) continue;
        const [bx, by, bz] = burst.position;
        b.setTranslation({ x: bx, y: by + 0.2, z: bz }, true);
        // Fling outward in an upward hemisphere, scaled by impact.
        const theta = rng.current.range(0, Math.PI * 2);
        const spd = rng.current.range(2, 6) * (0.5 + burst.strength);
        const up = rng.current.range(3, 7) * (0.5 + burst.strength);
        b.setLinvel({ x: Math.cos(theta) * spd, y: up, z: Math.sin(theta) * spd }, true);
        b.wakeUp();
        age.current[head.current === 0 ? POOL - 1 : head.current - 1] = 0;
      }
    }
  });

  return (
    <>
      {Array.from({ length: POOL }, (_, i) => (
        <RigidBody
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed pool, stable index
          key={i}
          ref={(r) => {
            bodies.current[i] = r;
          }}
          position={[0, -1000, 0]}
          colliders={false}
          linearDamping={0.4}
          friction={0.6}
          restitution={0.35}
          canSleep
        >
          <BallCollider args={[RADIUS]} />
          <mesh>
            <sphereGeometry args={[RADIUS, 10, 10]} />
            <meshStandardMaterial
              color={hex(palette.blob[skin])}
              emissive={hex(palette.blob[skin])}
              emissiveIntensity={0.25}
              roughness={0.25}
            />
          </mesh>
        </RigidBody>
      ))}
    </>
  );
}
