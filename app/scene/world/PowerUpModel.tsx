import { useGLTF } from "@react-three/drei";
import { useMemo } from "react";
import type { PowerUpType } from "@/core/types";
import { palette } from "@/styles/tokens";

/**
 * GLB powerup models (3DLowPoly): a Space-Kit rocket for the hyper-thrust and a
 * U-curve "magnet" for the magnet powerup, replacing the cone/torus primitives. Served
 * from public/assets/models via the Vite base URL so the path is correct on Pages
 * (/blobolines/) and Capacitor (./). Cloned per instance; tinted to the powerup color.
 */
const MODEL = {
  magnet: {
    url: "magnet.glb",
    scale: 0.9,
    color: palette.tramp.blue,
    rotation: [0, 0, Math.PI] as const,
  },
  thruster: {
    url: "rocket.glb",
    scale: 0.5,
    color: palette.tramp.orange,
    rotation: [0, 0, 0] as const,
  },
} satisfies Record<
  PowerUpType,
  { url: string; scale: number; color: string; rotation: readonly [number, number, number] }
>;

const url = (file: string) => `${import.meta.env.BASE_URL}assets/models/${file}`;

export function PowerUpModel({ type }: { type: PowerUpType }) {
  const spec = MODEL[type];
  const { scene } = useGLTF(url(spec.url));
  // Clone so multiple instances + tint don't share/mutate the cached scene.
  const model = useMemo(() => {
    const c = scene.clone(true);
    c.traverse((o) => {
      const mesh = o as unknown as {
        isMesh?: boolean;
        material?: {
          color?: { set: (c: string) => void };
          emissive?: { set: (c: string) => void };
          emissiveIntensity?: number;
        };
      };
      if (mesh.isMesh && mesh.material) {
        mesh.material = { ...mesh.material } as typeof mesh.material;
        mesh.material.emissive?.set(spec.color);
        if (mesh.material.emissiveIntensity !== undefined) mesh.material.emissiveIntensity = 0.4;
      }
    });
    return c;
  }, [scene, spec.color]);

  return <primitive object={model} scale={spec.scale} rotation={spec.rotation} />;
}

// Preload both so they pop in without a hitch on first spawn — but NOT under vitest, where
// a module-scope fetch races the browser-test bundler ("Vite unexpectedly reloaded a test").
if (!import.meta.env.VITEST) {
  useGLTF.preload(url(MODEL.magnet.url));
  useGLTF.preload(url(MODEL.thruster.url));
}
