import { useGLTF } from "@react-three/drei";
import { useMemo } from "react";
import type { Material, Mesh, MeshStandardMaterial } from "three";
import type { PowerUpType } from "@/core/types";
import { palette } from "@/styles/tokens";
import { PrimitivePowerup } from "./PrimitivePowerup";

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
} satisfies Partial<
  Record<
    PowerUpType,
    { url: string; scale: number; color: string; rotation: readonly [number, number, number] }
  >
>;

/** Power-up types that have a GLB model (others render their primitive — e.g. shield). */
type ModelledType = keyof typeof MODEL;
const hasModel = (t: PowerUpType): t is ModelledType => t in MODEL;

const url = (file: string) => `${import.meta.env.BASE_URL}assets/models/${file}`;

export function PowerUpModel({ type }: { type: PowerUpType }) {
  // Dispatch (no hook above this) so the GLB component's useGLTF is never called conditionally.
  // Model-less types (shield, slow-mo) render their shared primitive — same look as the
  // Suspense fallback, so there's no orb/gem duplication to drift.
  return hasModel(type) ? <GlbModel type={type} /> : <PrimitivePowerup type={type} />;
}

/** A GLB-backed power-up (magnet/thruster) — useGLTF is called unconditionally here. */
function GlbModel({ type }: { type: ModelledType }) {
  const spec = MODEL[type];
  const { scene } = useGLTF(url(spec.url));
  // Clone so multiple instances + tint don't share/mutate the cached scene.
  const model = useMemo(() => {
    const c = scene.clone(true);
    c.traverse((o) => {
      const mesh = o as Mesh;
      if (!mesh.isMesh) return;
      const src = mesh.material;
      // Clone the material via THREE's own .clone() (NOT object spread — spreading a
      // Material yields a plain object that loses the prototype/dispose/isMaterial), so
      // tinting one instance doesn't mutate the shared cached material.
      const mats = Array.isArray(src) ? src : [src];
      const cloned = mats.map((m) => {
        const cm = (m as Material).clone() as MeshStandardMaterial;
        cm.emissive?.set(spec.color);
        if ("emissiveIntensity" in cm) cm.emissiveIntensity = 0.4;
        return cm;
      });
      mesh.material = Array.isArray(src) ? cloned : cloned[0];
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
