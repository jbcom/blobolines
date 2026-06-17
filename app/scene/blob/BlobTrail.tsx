import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  DynamicDrawUsage,
  Float32BufferAttribute,
  type Mesh,
  Vector3,
} from "three";
import type { BlobSkin } from "@/core/types";
import { MAX_COMBO } from "@/sim/combo";
import { getBlobDiagnostics, useGameStore } from "@/state";
import { hex, palette } from "@/styles/tokens";

/**
 * BlobTrail — a continuous TAPERED ribbon streaming behind the airborne blob, replacing the
 * sparse trail dots. A ring buffer of recent blob positions is rebuilt each frame into a
 * camera-facing strip that tapers (wide at the blob → pinched at the tail) and fades out along
 * its length. The ribbon color IGNITES from the goo's skin tint toward flame as the clean-
 * bounce combo climbs, so a hot streak literally trails fire. Additive-blended, depth-write
 * off so it reads as wet light. Imperative (no React re-render); only live while moving fast.
 */
const SAMPLES = 24; // ribbon segments (positions kept)
const WIDTH = 0.55; // half-width at the head
const MIN_SPEED = 7; // below this the trail retracts

// Per-frame scratch — module-level (the component never runs two instances; matches the sibling
// VFX components' pattern) so the frame loop allocates nothing.
const tmpA = new Vector3();
const tmpDir = new Vector3();
const tmpSide = new Vector3();
const toCam = new Vector3();
const headCol = new Color();
const flame = new Color(hex(palette.goo.flame));

interface BlobTrailProps {
  skin: BlobSkin;
}

export function BlobTrail({ skin }: BlobTrailProps) {
  const meshRef = useRef<Mesh>(null);
  const camera = useThree((s) => s.camera);

  // Ring buffer of recent head positions (newest at index 0), seeded off-screen.
  const pts = useRef<Vector3[]>(Array.from({ length: SAMPLES }, () => new Vector3(0, -9999, 0)));
  const seeded = useRef(false);

  // Pre-sized geometry: 2 verts per sample (left/right of the centerline), a triangle strip
  // expressed as indexed tris. Positions + colors + alpha rewritten each frame.
  const geo = useMemo(() => {
    const g = new BufferGeometry();
    const pos = new Float32BufferAttribute(new Float32Array(SAMPLES * 2 * 3), 3);
    const col = new Float32BufferAttribute(new Float32Array(SAMPLES * 2 * 3), 3);
    pos.setUsage(DynamicDrawUsage);
    col.setUsage(DynamicDrawUsage);
    g.setAttribute("position", pos);
    g.setAttribute("color", col);
    const idx: number[] = [];
    for (let i = 0; i < SAMPLES - 1; i++) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    g.setIndex(idx);
    return g;
  }, []);

  // Release the per-mount BufferGeometry on unmount (the trail remounts each run via the
  // `playing &&` gate; R3F does NOT auto-dispose a useMemo'd geometry passed as a prop).
  useEffect(() => () => geo.dispose(), [geo]);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const diag = getBlobDiagnostics();
    const [bx, by, bz] = diag.position;
    const fast = diag.airborne && diag.speed > MIN_SPEED;

    const buf = pts.current;
    // On first run (or after a teleport), collapse the whole ribbon to the head so it doesn't
    // streak across the world from the seed position.
    if (!seeded.current) {
      for (const v of buf) v.set(bx, by, bz);
      seeded.current = true;
    }
    // Push the new head: shift the buffer and set index 0 to the current position. When not
    // fast, feed the head position in too so the ribbon collapses onto the blob (retracts).
    for (let i = SAMPLES - 1; i > 0; i--) buf[i].copy(buf[i - 1]);
    buf[0].set(bx, by, bz);

    // Combo → ignite color from skin tint toward flame.
    const combo = useGameStore.getState().run.combo;
    const heat = Math.min(1, combo / MAX_COMBO);
    headCol.set(palette.blob[skin]).lerp(flame, heat);

    const posAttr = geo.getAttribute("position") as Float32BufferAttribute;
    const colAttr = geo.getAttribute("color") as Float32BufferAttribute;

    for (let i = 0; i < SAMPLES; i++) {
      const here = buf[i];
      // Tangent along the ribbon (toward the previous, older sample).
      const next = buf[Math.min(SAMPLES - 1, i + 1)];
      tmpDir.copy(here).sub(next);
      if (tmpDir.lengthSq() < 1e-6) tmpDir.set(0, 1, 0);
      tmpDir.normalize();
      // Side = perpendicular to (tangent, view dir) so the ribbon faces the camera.
      toCam.copy(camera.position).sub(here).normalize();
      tmpSide.copy(tmpDir).cross(toCam);
      if (tmpSide.lengthSq() < 1e-6) tmpSide.set(1, 0, 0);
      tmpSide.normalize();

      const taper = fast ? 1 - i / SAMPLES : 0; // pinch toward the tail; retract when slow
      const w = WIDTH * taper;
      tmpA.copy(here).addScaledVector(tmpSide, w);
      posAttr.setXYZ(i * 2, tmpA.x, tmpA.y, tmpA.z);
      tmpA.copy(here).addScaledVector(tmpSide, -w);
      posAttr.setXYZ(i * 2 + 1, tmpA.x, tmpA.y, tmpA.z);

      // Fade color out along the length (head bright → tail dark, dropping to 0 so additive
      // contributes nothing at the tail).
      const fade = taper;
      const r = headCol.r * fade;
      const gg = headCol.g * fade;
      const b = headCol.b * fade;
      colAttr.setXYZ(i * 2, r, gg, b);
      colAttr.setXYZ(i * 2 + 1, r, gg, b);
    }
    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
    // No computeBoundingSphere: the mesh is frustumCulled={false}, so the bounding sphere is
    // never read — computing it per frame would be dead work.
  });

  return (
    <mesh ref={meshRef} geometry={geo} frustumCulled={false}>
      <meshBasicMaterial vertexColors transparent blending={AdditiveBlending} depthWrite={false} />
    </mesh>
  );
}
