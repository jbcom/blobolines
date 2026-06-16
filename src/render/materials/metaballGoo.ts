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
 * u_count active count, u_color/u_rim the goo palette, u_time for shimmer.
 */

export const MAX_GOO_BALLS = 24;

export const MetaballGooMaterial = shaderMaterial(
  {
    u_balls: Array.from({ length: MAX_GOO_BALLS }, () => new THREE.Vector3()),
    u_radii: new Float32Array(MAX_GOO_BALLS),
    u_count: 0,
    u_color: new THREE.Color(palette.blob.blue),
    u_rim: new THREE.Color(palette.goo.rim),
    u_time: 0,
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
    uniform float u_time;

    varying vec3 vWorldPos;

    float smin(float a, float b, float k) {
      float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
      return mix(b, a, h) - k * h * (1.0 - h);
    }

    float field(vec3 p) {
      float d = MAX_DIST;
      for (int i = 0; i < MAX_BALLS; i++) {
        if (i >= u_count) break;
        float ball = length(p - u_balls[i]) - u_radii[i];
        d = smin(d, ball, 0.5);
      }
      return d;
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
      for (int i = 0; i < MAX_STEPS; i++) {
        vec3 p = ro + rd * t;
        float d = field(p);
        if (d < MIN_DIST) { hit = true; break; }
        t += d;
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

      vec3 col = u_color * (0.55 + 0.4 * diff) + spec + fres * u_rim * 0.8;
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
