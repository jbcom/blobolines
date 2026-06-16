import * as THREE from "three";
import { useMemo } from "react";
import { palette, hex } from "@/styles/tokens";

/**
 * Painterly vertical gradient sky dome (cover-art atmosphere): warm cream high up
 * fading down through dusty blue-teal to deep ruins haze. Rendered on the inside of
 * a large sphere with a vertex-driven gradient. Real final sky layer.
 */
export function SkyDome() {
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

  return (
    <mesh material={material} scale={150}>
      <sphereGeometry args={[1, 32, 16]} />
    </mesh>
  );
}
