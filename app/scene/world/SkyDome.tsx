import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { biomeSkyAt } from "@/config";
import { getBlobDiagnostics } from "@/state";
import { hex, palette } from "@/styles/tokens";

/** Exponential fog density — subtle, just enough to melt the far world cutoff into the
 *  biome color so distant pads fade in instead of popping at the far plane. */
const FOG_DENSITY = 0.0016;

/**
 * Height-reactive gradient sky dome. The backdrop TRANSITIONS as the blob climbs —
 * ground → sky → upper atmosphere → stratosphere → space → deep space (biome bands in
 * config/biomes.json), lerped continuously from the blob's altitude. Rendered on the
 * inside of a large sphere with a vertex-driven vertical gradient.
 */
export function SkyDome() {
  const matRef = useRef<THREE.ShaderMaterial | null>(null);

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uTop: { value: new THREE.Color(hex(palette.sky.top)) },
        uMid: { value: new THREE.Color(hex(palette.sky.mid)) },
        uDeep: { value: new THREE.Color(hex(palette.sky.deep)) },
        uCream: { value: new THREE.Color(hex(palette.cream)) },
      },
      vertexShader: /* glsl */ `
        varying vec3 vPos;
        void main() {
          vPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vPos;
        uniform vec3 uTop;
        uniform vec3 uMid;
        uniform vec3 uDeep;
        uniform vec3 uCream;
        void main() {
          float h = normalize(vPos).y * 0.5 + 0.5; // 0 bottom .. 1 top
          vec3 lower = mix(uDeep, uMid, smoothstep(0.0, 0.55, h));
          vec3 upper = mix(uMid, uTop, smoothstep(0.5, 1.0, h));
          vec3 col = mix(lower, upper, smoothstep(0.45, 0.6, h));
          // warm light shafts toward the upper-mid band
          col = mix(col, uCream, smoothstep(0.6, 0.95, h) * 0.35);
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
  }, []);
  matRef.current = material;

  // Biome fog: install an exponential fog and tint it to the current band's fog color each
  // frame so the far cutoff dissolves into the backdrop (atmosphere haze → space black).
  const scene = useThree((s) => s.scene);
  const fog = useMemo(() => new THREE.FogExp2(hex(palette.sky.mid), FOG_DENSITY), []);
  useEffect(() => {
    const prev = scene.fog;
    scene.fog = fog;
    return () => {
      scene.fog = prev;
    };
  }, [scene, fog]);

  useFrame(() => {
    const m = matRef.current;
    if (!m) return;
    const height = getBlobDiagnostics().position[1];
    const b = biomeSkyAt(height);
    (m.uniforms.uTop.value as THREE.Color).set(hex(b.top));
    (m.uniforms.uMid.value as THREE.Color).set(hex(b.mid));
    (m.uniforms.uDeep.value as THREE.Color).set(hex(b.deep));
    // Match fog to the band's fog color so distance haze reads as the right atmosphere.
    fog.color.set(hex(b.fog));
  });

  return (
    <mesh material={material} scale={150}>
      <sphereGeometry args={[1, 32, 16]} />
    </mesh>
  );
}
