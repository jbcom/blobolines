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
          void main() {
            float h = normalize(vPos).y * 0.5 + 0.5;
            vec3 lower = mix(uDeep, uMid, smoothstep(0.0, 0.62, h));
            vec3 upper = mix(uMid, uTop, smoothstep(0.5, 1.0, h));
            vec3 col = mix(lower, upper, smoothstep(0.46, 0.62, h));
            float sunWarmth = smoothstep(0.58, 0.98, h) * 0.2;
            col = mix(col, uSun, sunWarmth);
            gl_FragColor = vec4(col, 0.82);
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
    }
    fog.color.set(hex(b.fog));

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
