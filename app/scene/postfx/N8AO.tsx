import { useThree } from "@react-three/fiber";
import { N8AOPostPass } from "n8ao";
import { useEffect, useMemo, useRef } from "react";
import { Color } from "three";

/**
 * N8AO ambient-occlusion pass, wrapped for @react-three/postprocessing's EffectComposer.
 * AO darkens the contact creases where the goo meets a pad and where droplets fuse into
 * the body — it grounds the goo and gives the World-of-Goo volume that flat lighting can't.
 * Tuned soft + cheap (half-res, low quality tier) for the Pixel-5a render budget.
 *
 * Rendered as a <primitive> so the composer adds it after its RenderPass.
 */
export function N8AO() {
  const { scene, camera, size } = useThree();

  // Build the pass ONCE per scene/camera. Recreating it on resize would recompile shaders
  // and reallocate render targets every frame of a drag-resize — instead we resize in place
  // (the effect below). Seed the initial size from the current canvas at construction.
  const initW = useRef(size.width);
  const initH = useRef(size.height);
  const pass = useMemo(() => {
    const p = new N8AOPostPass(scene, camera, initW.current, initH.current);
    p.configuration.aoRadius = 1.6; // world units — tight creases, not a global dim
    p.configuration.distanceFalloff = 1.0;
    p.configuration.intensity = 2.2;
    p.configuration.color = new Color(0, 0, 0);
    // Half-resolution AO is plenty for soft contact shading and halves the cost on mobile.
    p.configuration.halfRes = true;
    p.setQualityMode?.("Low");
    return p;
  }, [scene, camera]);

  // Resize the existing pass in place when the canvas changes size.
  useEffect(() => {
    pass.setSize?.(size.width, size.height);
  }, [pass, size.width, size.height]);

  useEffect(() => () => pass.dispose?.(), [pass]);

  return <primitive object={pass} />;
}
