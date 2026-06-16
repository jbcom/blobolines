import { shaderMaterial } from "@react-three/drei";
import { extend, type ThreeElement } from "@react-three/fiber";
import * as THREE from "three";
import { palette } from "@/styles/tokens";

/**
 * MetaballGooMaterial — raymarched metaball isosurface that merges the blob body with
 * nearby goo droplets into one continuous gooey blob (the World-of-Goo merge look). The
 * field is `smin`-blended point sources, raymarched on a hull mesh, shaded wet (fresnel
 * rim + specular). This is the cabinet-proven 60fps goo path (adapted from kings-road
 * bloodMetaballs) — chosen over per-frame three-bvh-csg mesh booleans, which rebuild
 * topology every frame and have no working cabinet precedent.
 *
 * Uniforms: u_balls[] world-space metaball centers, u_radii[] per-ball radius,
 * u_count active count, u_color/u_rim the goo palette, u_time for shimmer, u_heat [0,1]
 * the combo "flame" charge that ignites a warm pulsing fresnel glow as the streak builds.
 */

export const MAX_GOO_BALLS = 24;

export const MetaballGooMaterial = shaderMaterial(
  {
    u_balls: Array.from({ length: MAX_GOO_BALLS }, () => new THREE.Vector3()),
    u_radii: new Float32Array(MAX_GOO_BALLS),
    u_count: 0,
    u_color: new THREE.Color(palette.blob.blue),
    u_rim: new THREE.Color(palette.goo.rim),
    u_flame: new THREE.Color(palette.goo.flame),
    u_time: 0,
    u_heat: 0,
    u_wobble: 0,
  },
  /* glsl */ `
    varying vec3 vWorldPos;
    void main() {
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vWorldPos = wp.xyz;
      gl_Position = projectionMatrix * viewMatrix * wp;
    }
  `,
  /* glsl */ `
    precision highp float;
    #define MAX_BALLS ${MAX_GOO_BALLS}
    #define MAX_STEPS 48
    #define MIN_DIST 0.004
    #define MAX_DIST 12.0

    uniform vec3 u_balls[MAX_BALLS];
    uniform float u_radii[MAX_BALLS];
    uniform int u_count;
    uniform vec3 u_color;
    uniform vec3 u_rim;
    uniform vec3 u_flame;
    uniform float u_time;
    uniform float u_heat;
    uniform float u_wobble;

    varying vec3 vWorldPos;

    float smin(float a, float b, float k) {
      float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
      return mix(b, a, h) - k * h * (1.0 - h);
    }

    // Surface-tension jiggle: a signed multi-lobe ripple in world space, scaled by the
    // impact wobble envelope, that pushes the isosurface in and out so a landing sends a
    // wave across the goo that settles like a water balloon. Added to the SDF so it warps
    // every ball uniformly (the whole skin ripples, not just the body sphere).
    float wobbleField(vec3 p) {
      if (u_wobble < 0.001) return 0.0;
      float w = sin(p.x * 4.0 + u_time * 9.0)
              + sin(p.y * 5.0 - u_time * 7.0)
              + sin(p.z * 4.5 + u_time * 11.0);
      return w * (1.0 / 3.0) * u_wobble * 0.18;
    }

    float field(vec3 p) {
      float d = MAX_DIST;
      for (int i = 0; i < MAX_BALLS; i++) {
        if (i >= u_count) break;
        float ball = length(p - u_balls[i]) - u_radii[i];
        d = smin(d, ball, 0.5);
      }
      return d + wobbleField(p);
    }

    vec3 fieldNormal(vec3 p) {
      const float e = 0.01;
      return normalize(vec3(
        field(p + vec3(e, 0.0, 0.0)) - field(p - vec3(e, 0.0, 0.0)),
        field(p + vec3(0.0, e, 0.0)) - field(p - vec3(0.0, e, 0.0)),
        field(p + vec3(0.0, 0.0, e)) - field(p - vec3(0.0, 0.0, e))
      ));
    }

    void main() {
      if (u_count == 0) discard;
      vec3 rd = normalize(vWorldPos - cameraPosition);
      vec3 ro = vWorldPos;
      float t = 0.0;
      bool hit = false;
      // The wobble term adds spatial gradient to the field, so its Lipschitz constant rises
      // above 1 and a full unscaled step would overstep the surface (holes in the goo).
      // Shorten the step by a bound on that gradient while wobble is active — full-speed
      // marching when cold (u_wobble == 0), so there's no idle perf cost.
      // Divisor bounds the wobble term's spatial gradient (freqs 4/5/4.5, amp 0.18 →
      // grad ≲ 0.81) so the marcher stays conservative and never oversteps the surface.
      float stepScale = 1.0 / (1.0 + u_wobble * 0.85);
      for (int i = 0; i < MAX_STEPS; i++) {
        vec3 p = ro + rd * t;
        float d = field(p);
        if (d < MIN_DIST) { hit = true; break; }
        t += d * stepScale;
        if (t > MAX_DIST) break;
      }
      if (!hit) discard;

      vec3 p = ro + rd * t;
      vec3 n = fieldNormal(p);
      vec3 V = -rd;
      vec3 L = normalize(vec3(0.3, 0.8, 0.6));
      vec3 H = normalize(L + V);

      float diff = max(dot(n, L), 0.0);
      float fres = pow(1.0 - max(dot(n, V), 0.0), 3.0);
      float shimmer = 1.0 + 0.06 * sin(u_time * 3.0 + p.x * 4.0 + p.y * 3.0);
      float spec = pow(max(dot(n, H), 0.0), 48.0) * 1.6 * shimmer;

      // Combo flame: as the streak heats up, the goo turns molten — its body color is
      // pushed toward the warm flame hue and the fresnel edge ignites with a pulsing
      // glow, so it reads as fire (not a blue blob with an orange outline).
      float flicker = 0.7 + 0.3 * sin(u_time * 14.0 + p.y * 6.0);
      vec3 base = mix(u_color, u_flame, u_heat * 0.7);
      vec3 rim = mix(u_rim, u_flame, u_heat);

      vec3 col = base * (0.55 + 0.4 * diff) + spec + fres * rim * 0.8;
      // Hot fresnel edge licks brighter than white where the streak is at full heat.
      col += u_flame * fres * u_heat * 1.8 * flicker;

      // This material renders outside the renderer's tonemapping pass (drei shaderMaterial
      // has no tonemapping chunk), so the bright flame rim would blow out to flat white and
      // lose its hue. Roll off ONLY the part above 1.0 with a soft knee — values below 1
      // (the entire cold base goo) pass through untouched, so the blue blob is unchanged.
      vec3 over = max(col - vec3(1.0), vec3(0.0));
      col = min(col, vec3(1.0)) + over / (over + vec3(1.0)); // soft-clamp the excess hue

      gl_FragColor = vec4(col, 1.0);
    }
  `,
);

extend({ MetaballGooMaterial });

declare module "@react-three/fiber" {
  interface ThreeElements {
    metaballGooMaterial: ThreeElement<typeof MetaballGooMaterial>;
  }
}
