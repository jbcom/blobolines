import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { CanvasTexture, type Mesh, MeshBasicMaterial } from "three";
import { getBlobDiagnostics } from "@/state";

/**
 * A FAKE soft contact shadow under the blob — a flat dark radial-gradient disc that follows
 * the blob's x/z and rides just above the nearest surface, NOT a real shadow-map or drei
 * ContactShadows pass. (ContactShadows runs its own offscreen render that fights the
 * postprocessing EffectComposer's render targets; a flat textured disc sidesteps that
 * entirely and is far cheaper on mobile.) It shrinks + fades as the blob rises away from a
 * pad (altitude) and widens as the blob squashes flat, so it reads as real ground contact.
 */
export function BlobShadow() {
  const meshRef = useRef<Mesh>(null);

  // A soft radial gradient baked once into a canvas texture (dark center → transparent).
  const { texture, material } = useMemo(() => {
    const size = 128;
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const ctx = c.getContext("2d");
    if (ctx) {
      const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      g.addColorStop(0, "rgba(0,0,0,0.4)");
      g.addColorStop(0.55, "rgba(0,0,0,0.16)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, size, size);
    }
    const tex = new CanvasTexture(c);
    // Plain alpha-blended dark disc (the texture's own radial alpha gives the soft edge).
    // NOT SubtractiveBlending — that needs premultipliedAlpha and reads as a harsh dark
    // hole. depthWrite off so it lies flat on the pad without z-fighting.
    const mat = new MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
    return { texture: tex, material: mat };
  }, []);

  // Free the baked texture + material on unmount (run end remounts the scene).
  useEffect(() => {
    return () => {
      texture.dispose();
      material.dispose();
    };
  }, [texture, material]);

  useFrame(() => {
    const m = meshRef.current;
    if (!m) return;
    const { position, squash, groundY } = getBlobDiagnostics();
    const [bx, by, bz] = position;

    // The shadow rests on the pad the blob last landed on (groundY), tracking its x/z. As
    // the blob arcs up, `lift` grows → the disc shrinks + fades; on the way back down it
    // tightens again, so it reads as the blob approaching the ground.
    const lift = Math.max(0, by - groundY);
    m.position.set(bx, groundY + 0.06, bz);

    // Squash widens the disc a touch (puddle spreads on contact); altitude shrinks + fades.
    const altScale = 1 / (1 + lift * 0.18);
    const spread = 1 + (1 - Math.min(1, squash)) * 0.6;
    m.scale.set(spread * altScale, spread * altScale, 1);
    material.opacity = 0.75 * altScale;
  });

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} material={material}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  );
}
