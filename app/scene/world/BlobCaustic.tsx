import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { AdditiveBlending, CanvasTexture, type Color, type Mesh, MeshBasicMaterial } from "three";
import type { BlobSkin } from "@/core/types";
import { getBlobDiagnostics } from "@/state";
import { palette } from "@/styles/tokens";

/**
 * BlobCaustic — a fake moving light DAPPLE cast under the goo onto the pad, like light
 * refracting through the wet body. A soft blobby caustic texture (baked once) on an additive
 * disc, tinted by the skin, that slowly rotates + breathes and brightens as the blob nears the
 * ground (strongest when resting on a pad, gone at altitude). Sits just above the contact
 * shadow. Pure decoration — flat disc, no extra render pass (mobile-cheap).
 */
export function BlobCaustic({ skin }: { skin: BlobSkin }) {
  const meshRef = useRef<Mesh>(null);

  const { texture, material } = useMemo(() => {
    const size = 128;
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const ctx = c.getContext("2d");
    if (ctx) {
      // Overlapping soft white blobs → an organic caustic splotch, faded to transparent at the
      // rim by a radial mask drawn last with destination-in.
      ctx.fillStyle = "rgba(0,0,0,0)";
      ctx.fillRect(0, 0, size, size);
      const blob = (x: number, y: number, r: number, a: number) => {
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `rgba(255,255,255,${a})`);
        g.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, size, size);
      };
      blob(size * 0.42, size * 0.46, size * 0.3, 0.6);
      blob(size * 0.6, size * 0.55, size * 0.24, 0.5);
      blob(size * 0.5, size * 0.62, size * 0.18, 0.45);
      // Radial vignette mask so the dapple fades out before the disc edge.
      ctx.globalCompositeOperation = "destination-in";
      const m = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      m.addColorStop(0, "rgba(0,0,0,1)");
      m.addColorStop(0.7, "rgba(0,0,0,0.7)");
      m.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = m;
      ctx.fillRect(0, 0, size, size);
      ctx.globalCompositeOperation = "source-over";
    }
    const tex = new CanvasTexture(c);
    const mat = new MeshBasicMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    return { texture: tex, material: mat };
  }, []);

  useEffect(() => {
    (material.color as Color).set(palette.blob[skin]);
  }, [material, skin]);
  useEffect(
    () => () => {
      texture.dispose();
      material.dispose();
    },
    [texture, material],
  );

  useFrame((state) => {
    const m = meshRef.current;
    if (!m) return;
    const { position, groundY } = getBlobDiagnostics();
    const [bx, by, bz] = position;
    const lift = Math.max(0, by - groundY);

    // Sit just above the shadow on the pad, tracking x/z. Slow rotate + breathe = a living
    // dapple. Fade with altitude (strong on the pad, gone high up).
    m.position.set(bx, groundY + 0.07, bz);
    m.rotation.z = state.clock.elapsedTime * 0.4;
    const breathe = 1 + 0.12 * Math.sin(state.clock.elapsedTime * 2.2);
    const altFade = 1 / (1 + lift * 0.3);
    m.scale.set(1.5 * breathe, 1.5 * breathe, 1);
    material.opacity = 0.5 * altFade;
  });

  return (
    // renderOrder 1: draw the additive caustic AFTER the alpha shadow so it reads as added
    // light on top of the shadow, not darkened under it.
    <mesh ref={meshRef} renderOrder={1} rotation={[-Math.PI / 2, 0, 0]} material={material}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  );
}
