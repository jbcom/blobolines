import { shaderMaterial } from "@react-three/drei";
import { extend, type ThreeElement } from "@react-three/fiber";
import * as THREE from "three";

/**
 * GooMaterial — the wet, translucent, gooey surface for the blob. A standard 3D mesh
 * (so it deforms with squash-stretch), shaded for the World-of-Goo look: a saturated
 * base color, soft diffuse, a fresnel rim that reads as wet/volumetric, a sharp wet
 * specular highlight with a subtle time shimmer, and a touch of subsurface glow.
 *
 * Gooey-look recipe adapted from arcade-cabinet (marmalade-drops metaballFluid).
 */
export const GooMaterial = shaderMaterial(
  {
    uColor: new THREE.Color("#2e8bf0"),
    uRim: new THREE.Color("#bfe3ff"),
    uTime: 0,
    uWet: 0.9,
  },
  /* glsl */ `
    varying vec3 vNormalW;
    varying vec3 vViewDir;
    varying vec3 vPosL;
    void main() {
      vec4 worldPos = modelMatrix * vec4(position, 1.0);
      vNormalW = normalize(mat3(modelMatrix) * normal);
      vViewDir = normalize(cameraPosition - worldPos.xyz);
      vPosL = position;
      gl_Position = projectionMatrix * viewMatrix * worldPos;
    }
  `,
  /* glsl */ `
    precision highp float;
    uniform vec3  uColor;
    uniform vec3  uRim;
    uniform float uTime;
    uniform float uWet;

    varying vec3 vNormalW;
    varying vec3 vViewDir;
    varying vec3 vPosL;

    const vec3 LIGHT_DIR = vec3(0.3, 1.0, 0.6);

    void main() {
      vec3 N = normalize(vNormalW);
      vec3 V = normalize(vViewDir);
      vec3 L = normalize(LIGHT_DIR);
      vec3 H = normalize(L + V);

      float diffuse  = max(dot(N, L), 0.0);
      float fresnel  = pow(1.0 - max(dot(N, V), 0.0), 3.0);
      float shimmer  = 1.0 + 0.06 * sin(uTime * 3.2 + vPosL.x * 4.0 + vPosL.y * 3.0);
      float specular = pow(max(dot(N, H), 0.0), 48.0) * 1.6 * uWet * shimmer;

      // Soft subsurface-ish glow: a little light wraps around the body.
      float wrap = max(dot(N, L) * 0.5 + 0.5, 0.0);

      vec3 base   = uColor * (0.55 + 0.35 * wrap);
      vec3 lit    = base + uColor * diffuse * 0.5;
      vec3 finalC = lit + specular + fresnel * uRim * 0.8;

      gl_FragColor = vec4(finalC, 1.0);
    }
  `,
);

extend({ GooMaterial });

declare module "@react-three/fiber" {
  interface ThreeElements {
    gooMaterial: ThreeElement<typeof GooMaterial>;
  }
}
