import { shaderMaterial } from "@react-three/drei";
import { extend, type ThreeElement } from "@react-three/fiber";
import * as THREE from "three";
import { palette } from "@/styles/tokens";

/**
 * GooMaterial — the wet, translucent, gooey surface for the blob. A standard 3D mesh
 * (so it deforms with squash-stretch), shaded for the World-of-Goo look: a saturated
 * base color, soft diffuse, a fresnel rim that reads as wet/volumetric, a sharp wet
 * specular highlight with a subtle time shimmer, and a touch of subsurface glow.
 *
 * Gooey-look recipe adapted from arcade-cabinet (marmalade-drops metaballFluid).
 *
 * A MYRIAD of vertex-level deformations keep Blobby gooey, never a clean sphere — all summed
 * into one signed `surfaceDisp(p)` so the analytic normal recompute stays valid:
 *   - uWobble [0,~1]  surface-tension jiggle that TRAVELS: a hard landing sends a ripple that
 *                     propagates around the body from the impact direction (uImpactDir) and
 *                     settles like a water balloon (impact-driven, decays in GooCsg).
 *   - uLobeDir/uLobe  a slow asymmetric bulge — the body is fatter on one side and wanders
 *                     over time, so it reads as an unstable gooey mass, not a symmetric ball.
 *   - uSag [0,~1]     wet gravity sag: the lower hemisphere droops + the equator bulges (a
 *                     resting goo puddle / heavy hang), driven by settle/rest in GooCsg.
 * The displaced normal is recomputed analytically (central difference) so lighting tracks
 * every mode.
 */
export const GooMaterial = shaderMaterial(
  {
    uColor: new THREE.Color(palette.blob.blue),
    uRim: new THREE.Color(palette.goo.rim),
    uTime: 0,
    uWet: 0.9,
    uWobble: 0,
    uSag: 0,
    uLobe: 0,
    uLobeDir: new THREE.Vector3(1, 0, 0),
    uImpactDir: new THREE.Vector3(0, -1, 0),
  },
  /* glsl */ `
    uniform float uTime;
    uniform float uWobble;
    uniform float uSag;
    uniform float uLobe;
    uniform vec3  uLobeDir;
    uniform vec3  uImpactDir;
    varying vec3 vNormalV;
    varying vec3 vViewDir;
    varying vec3 vPosL;

    // Combined signed surface displacement (along the normal) at a point on the unit-ish
    // sphere. Sum of every gooey mode so one analytic normal recompute covers them all.
    float surfaceDisp(vec3 p) {
      vec3 pn = normalize(p);

      // TRAVELLING jiggle: the ripple phase advances with distance ALONG the impact direction,
      // so the wobble visibly sweeps across the body from the contact point instead of
      // standing in place. A few overlapping frequencies keep it organic.
      float along = dot(pn, normalize(uImpactDir));
      float travel = sin(p.x * 5.0 + uTime * 9.0 - along * 6.0)
                   + sin(p.y * 6.0 - uTime * 7.0 - along * 5.0)
                   + sin(p.z * 4.0 + uTime * 11.0 - along * 7.0);
      float wob = travel * (1.0 / 3.0) * uWobble * 0.12;

      // ASYMMETRIC lobe: push the side facing uLobeDir outward (smoothstep so it's a soft
      // bulge, not a spike). The direction drifts (set on the CPU), so the fat side wanders.
      float face = max(dot(pn, normalize(uLobeDir)), 0.0);
      float lobe = smoothstep(0.0, 1.0, face) * uLobe * 0.16;

      // WET SAG: drop the lower hemisphere (heavier toward -Y) and bulge the equator, like
      // goo hanging/settling under its own weight. Strongest at the bottom, fades up.
      float lower = clamp(-pn.y * 0.5 + 0.5, 0.0, 1.0);
      float belt  = 1.0 - abs(pn.y);
      float sag = uSag * (-0.14 * lower * lower + 0.08 * belt);

      return wob + lobe + sag;
    }

    void main() {
      vec3 n = normalize(normal);
      float d = surfaceDisp(position);
      vec3 displaced = position + n * d;

      // Recompute the normal from two displaced tangent neighbours so lighting tracks the
      // deformation (central-difference gradient of the displaced surface).
      vec3 t1 = normalize(abs(n.y) < 0.99 ? cross(n, vec3(0.0, 1.0, 0.0)) : vec3(1.0, 0.0, 0.0));
      vec3 t2 = cross(n, t1);
      float e = 0.05;
      vec3 pa = position + t1 * e; pa += normalize(pa) * surfaceDisp(pa);
      vec3 pb = position + t2 * e; pb += normalize(pb) * surfaceDisp(pb);
      vec3 wobbleN = normalize(cross(pa - displaced, pb - displaced));
      // The cross product can flip; keep it on the outward side.
      if (dot(wobbleN, n) < 0.0) wobbleN = -wobbleN;
      // Blend toward the deformed normal by how much total deformation is active.
      float deformAmt = clamp(uWobble + uLobe + uSag, 0.0, 1.0);
      vec3 useN = mix(n, wobbleN, deformAmt);

      vec4 viewPos = modelViewMatrix * vec4(displaced, 1.0);
      // normalMatrix = transpose(inverse(modelViewMatrix)) — correct under the
      // non-uniform squash-stretch scale; lighting is done in view space.
      vNormalV = normalize(normalMatrix * useN);
      vViewDir = normalize(-viewPos.xyz); // camera is at the origin in view space
      vPosL = position;
      gl_Position = projectionMatrix * viewPos;
    }
  `,
  /* glsl */ `
    precision highp float;
    uniform vec3  uColor;
    uniform vec3  uRim;
    uniform float uTime;
    uniform float uWet;

    varying vec3 vNormalV;
    varying vec3 vViewDir;
    varying vec3 vPosL;

    // Fixed view-space key light (top-front-right) — stylized, camera-relative.
    const vec3 LIGHT_DIR = vec3(0.3, 0.7, 0.9);

    void main() {
      vec3 N = normalize(vNormalV);
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
