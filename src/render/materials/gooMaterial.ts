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
    // Biome-reactive lighting: the goo picks up the current sky's key color (warm at ground,
    // cool/moody in space) and a darkening factor as it climbs into thinner/darker biomes.
    uEnvTint: new THREE.Color(palette.sky.top),
    uEnvLight: 0,
    // Backbuffer refraction (HIGH tier only): the scene rendered behind the blob, sampled with a
    // normal×fresnel screen-UV offset so the jelly BENDS what's behind it. uRefraction = 0 keeps
    // the pass inert (mid/low tiers never set the texture), so the shader is unchanged off-HIGH.
    uBackbuffer: null,
    uRefraction: 0,
    uResolution: new THREE.Vector2(1, 1),
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
    uniform vec3  uEnvTint;   // biome key color the goo picks up
    uniform float uEnvLight;  // [0,1] how strongly the biome tints the goo
    uniform sampler2D uBackbuffer; // scene rendered behind the blob (HIGH tier)
    uniform float uRefraction;     // 0 = off (mid/low); >0 = how strongly the blob bends the bg
    uniform vec2  uResolution;     // drawing-buffer size, for the gl_FragCoord → screen-UV

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
      // Tight wet hotspot. Tightened (exp 70) + leveled down so the deformed (sag/lobe) body
      // doesn't present a big grazing-angle slab that blows the highlight to pure white and
      // washes out the goo color — the spec should read as a wet glint, not a flare.
      float specular = pow(max(dot(N, H), 0.0), 70.0) * 0.9 * uWet * shimmer;

      // Soft subsurface-ish glow: a little light wraps around the body.
      float wrap = max(dot(N, L) * 0.5 + 0.5, 0.0);

      vec3 base   = uColor * (0.55 + 0.35 * wrap);
      vec3 lit    = base + uColor * diffuse * 0.5;
      // Biome-reactive: bend the lit body color toward the biome key color (warm at ground,
      // cool/moody high up) on the LIT side, so the blob feels embedded in its environment.
      lit = mix(lit, lit * (0.6 + 0.8 * uEnvTint), uEnvLight * (0.4 + 0.6 * wrap));
      // Beer-Lambert-ish thickness, applied LAST so it doesn't compound with the biome tint:
      // looking straight INTO the body (low fresnel) means more goo to look through, so the
      // center reads a touch deeper/darker than the thin grazing edge — volumetric "depth in
      // the jelly". A flat darken (not a *uColor re-multiply, which squared the hue and muddied
      // non-blue skins) keeps it palette-independent; (1-fresnel) proxies path length.
      float thickness = 1.0 - fresnel;
      lit *= 1.0 - 0.22 * thickness;
      // Tint the specular by a touch of the goo color so the hotspot stays "wet goo", not a
      // white hole; keep the rim fresnel for the volumetric edge — the rim also picks up the
      // biome tint (the wet edge catches the sky). FLOOR the biome-tinted rim at 40% of the
      // base rim so a dark-sky biome (deep space tops ~#180a30) can't snuff out the wet edge
      // that defines the goo silhouette — it goes moody, not invisible.
      vec3 spec   = specular * mix(vec3(1.0), uColor, 0.25);
      vec3 rimCol = mix(uRim, max(uRim * uEnvTint * 1.6, uRim * 0.4), uEnvLight);
      vec3 finalC = lit + spec + fresnel * rimCol * 0.8;

      // BACKBUFFER REFRACTION (HIGH tier; uRefraction=0 → skipped). Sample the scene rendered
      // behind the blob at a screen-UV offset along the surface normal — the jelly bends what's
      // behind it. The offset scales with the view-space normal's screen-plane tilt (N.xy) so a
      // grazing face displaces more, and the refracted background shows through more at the THIN
      // (high-fresnel) edges, blending back to the goo color through the thick centre.
      if (uRefraction > 0.0) {
        vec2 screenUV = gl_FragCoord.xy / uResolution;
        vec2 off = N.xy * uRefraction * (0.35 + 0.65 * fresnel);
        vec3 bg = texture2D(uBackbuffer, screenUV + off).rgb;
        // See-through amount: more at the thin edge, tapered into the body so the centre stays
        // goo. Tint the transmitted light by the goo color (light passing through coloured jelly).
        float seeThrough = 0.55 * fresnel + 0.15;
        finalC = mix(finalC, bg * mix(vec3(1.0), uColor, 0.45) + spec, seeThrough);
      }

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
