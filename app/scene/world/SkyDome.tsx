import { Sky } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { biomeSkyAt } from "@/config";
import { getBlobDiagnostics } from "@/state";
import { hex, palette } from "@/styles/tokens";

/** Exponential fog density — subtle, just enough to melt the far world cutoff into the
 *  biome color so distant pads fade in instead of popping at the far plane. */
const FOG_DENSITY = 0.0014;
const SUN_POSITION = [-45, 55, -95] as const;
const SUN_SPRITE_OFFSET = [-54, 44, -76] as const;

/**
 * Physical daylight sky. Drei's <Sky> wraps Three's atmospheric Sky object, so the backdrop
 * can be bright blue without reading sterile; warm fog, cream sun sprites, and warm foreground
 * lighting keep the scene cheerful and candy-like.
 */
export function SkyDome() {
  const washRef = useRef<THREE.ShaderMaterial | null>(null);
  // drei's <Sky> forwards its ref to the underlying sky mesh (a Mesh with a ShaderMaterial).
  const skyRef = useRef<THREE.Mesh<THREE.BoxGeometry, THREE.ShaderMaterial> | null>(null);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const fog = useMemo(() => new THREE.FogExp2(hex(palette.sky.haze), FOG_DENSITY), []);
  const sunRef = useRef<THREE.Group>(null);
  const washMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
        uniforms: {
          uTop: { value: new THREE.Color(hex(palette.sky.top)) },
          uMid: { value: new THREE.Color(hex(palette.sky.mid)) },
          uDeep: { value: new THREE.Color(hex(palette.sky.deep)) },
          uSun: { value: new THREE.Color(hex(palette.sun)) },
          // Opacity of the painterly band gradient. Low at ground (lets drei's atmospheric <Sky>
          // bleed through for a real-daylight feel) → 1.0 by the upper bands, where the band color
          // (icy gold, sunset, near-black space) must read TRUE instead of being washed white by the
          // bright static atmospheric sky behind it. Driven per-frame from altitude (see useFrame).
          uAlpha: { value: 0.82 },
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
          uniform vec3 uSun;
          uniform float uAlpha;
          void main() {
            float h = normalize(vPos).y * 0.5 + 0.5;
            vec3 lower = mix(uDeep, uMid, smoothstep(0.0, 0.62, h));
            vec3 upper = mix(uMid, uTop, smoothstep(0.5, 1.0, h));
            vec3 col = mix(lower, upper, smoothstep(0.46, 0.62, h));
            float sunWarmth = smoothstep(0.58, 0.98, h) * 0.2;
            col = mix(col, uSun, sunWarmth);
            gl_FragColor = vec4(col, uAlpha);
          }
        `,
      }),
    [],
  );
  washRef.current = washMaterial;

  useEffect(() => {
    const prev = scene.fog;
    scene.fog = fog;
    return () => {
      scene.fog = prev;
    };
  }, [scene, fog]);

  useFrame(() => {
    const height = getBlobDiagnostics().position[1];
    const b = biomeSkyAt(height);
    const wash = washRef.current;
    if (wash) {
      (wash.uniforms.uTop.value as THREE.Color).set(hex(b.top));
      (wash.uniforms.uMid.value as THREE.Color).set(hex(b.mid));
      (wash.uniforms.uDeep.value as THREE.Color).set(hex(b.deep));
      // Painterly gradient opacity ramps 0.82 → 1.0 as the climb leaves the lower atmosphere, so the
      // upper bands' true colors (icy gold, sunset, near-black space) aren't washed white by the
      // bright static <Sky> behind. Fully opaque by the upper-atmosphere band (~320m) — that band is
      // where the wash must already own the backdrop, not only by space.
      wash.uniforms.uAlpha.value = 0.82 + 0.18 * THREE.MathUtils.clamp(height / 320, 0, 1);
    }
    fog.color.set(hex(b.fog));

    // The bright physical daylight <Sky> belongs to the low atmosphere — fade it out from ~120m (the
    // sky band) so it's GONE by the upper-atmosphere band (~320m), where the painterly band gradient
    // must own the backdrop. Otherwise its desaturated white atmospheric haze leaks through the
    // center of the view and washes the upper/space bands toward grey-white (the bug this fixes).
    const sky = skyRef.current;
    if (sky) {
      const skyMat = sky.material as THREE.Material;
      const skyFade = 1 - THREE.MathUtils.clamp((height - 120) / 200, 0, 1);
      skyMat.transparent = true;
      skyMat.opacity = skyFade;
      sky.visible = skyFade > 0.01;
    }

    // Sun sprite — the visible SOURCE of the warm shafts. It tracks the camera so the player
    // keeps a bright warm cue in view while climbing, and fades as the run reaches space.
    const sun = sunRef.current;
    if (!sun) return;
    sun.position.set(
      camera.position.x + SUN_SPRITE_OFFSET[0],
      camera.position.y + SUN_SPRITE_OFFSET[1],
      camera.position.z + SUN_SPRITE_OFFSET[2],
    );
    sun.lookAt(camera.position);
    const fade = Math.max(0, 1 - height / 850);
    sun.visible = fade > 0.02;
    for (const child of sun.children) {
      const mat = (child as THREE.Mesh).material as THREE.MeshBasicMaterial;
      mat.opacity = (child === sun.children[0] ? 0.58 : 0.14) * fade;
    }
  });

  return (
    <>
      <Sky
        ref={skyRef}
        distance={450000}
        sunPosition={SUN_POSITION}
        turbidity={2.4}
        rayleigh={1.7}
        mieCoefficient={0.0018}
        mieDirectionalG={0.58}
      />
      <mesh material={washMaterial} scale={180} renderOrder={-5}>
        <sphereGeometry args={[1, 40, 20]} />
      </mesh>
      <group ref={sunRef} position={[40, 80, -90]}>
        <mesh>
          <circleGeometry args={[2.8, 32]} />
          <meshBasicMaterial
            color={hex(palette.cream)}
            transparent
            opacity={0.9}
            depthWrite={false}
            fog={false}
          />
        </mesh>
        <mesh>
          <circleGeometry args={[9.5, 32]} />
          <meshBasicMaterial
            color={hex(palette.sun)}
            transparent
            opacity={0.34}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            fog={false}
          />
        </mesh>
      </group>
    </>
  );
}
