import { useFrame } from "@react-three/fiber";
import { CuboidCollider, type RapierRigidBody, RigidBody } from "@react-three/rapier";
import { useEffect, useMemo, useRef } from "react";
import { CanvasTexture, type Group, SRGBColorSpace } from "three";
import { playBounce } from "@/audio";
import { biomeSkyAt, trampoline as trampCfg } from "@/config";
import { clamp } from "@/core/math";
import type { TrampType } from "@/core/types";
import { getQuality } from "@/render/qualityBridge";
import { createSplatCanvas } from "@/render/vfx";
import { MAX_IMPACT_SPEED } from "@/sim/physics";
import {
  cantEuler,
  cantNormal,
  createTrampState,
  impactTargets,
  REBOUND_SETTLE_SPEED,
  reboundMultiplier,
  SUPER_MIN_REBOUND,
  stepTramp,
  type TrampState,
} from "@/sim/trampoline";
import { reportImpact, reportLanding, reportRebound, useGameStore } from "@/state";
import { mixHex, palette, trampColor } from "@/styles/tokens";
import { PadTypeDecor } from "./PadTypeDecor";

/**
 * A single trampoline: a fixed Rapier body (the blob bounces off it) with a squishy
 * animated mesh that depresses + tilts on impact via the spring model, then springs
 * back. The membrane (top surface) carries the bounce; a sensor reports impacts so the
 * game loop can launch the blob and play juice.
 */

interface TrampolineProps {
  id: number;
  position: readonly [number, number, number];
  width: number;
  depth: number;
  type: TrampType;
  /** Lateral cant direction for "canted" pads (unit [x,z]); the bounce launches along the
   *  resulting tilted normal so the blob is thrown toward the next pad. */
  cant?: readonly [number, number];
  /** Optional per-pad cant strength in radians. */
  cantAngleRad?: number;
  /** Unit [x,z] slider rail direction for moving pads. */
  moveAxis?: readonly [number, number];
  /** Called when the blob lands, with impact speed + relative hit point. */
  onImpact?: (speed: number, relX: number, relZ: number) => void;
}

const THICKNESS = 1.2;
const { movingAmplitude, movingSpeed } = trampCfg;
const WOBBLER_MAX_TILT = trampCfg.wobblerMaxTiltRad;

function TrampolineFrame({ width, depth, color }: { width: number; depth: number; color: string }) {
  const y = THICKNESS / 2 + 0.2;
  const radius = Math.max(width, depth) * 0.42;
  return (
    <mesh position={[0, y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <torusGeometry args={[radius, 0.16, 14, 48]} />
      <meshStandardMaterial color={color} roughness={0.24} metalness={0.35} />
    </mesh>
  );
}

function PerimeterLaces({ width, depth, color }: { width: number; depth: number; color: string }) {
  const y = THICKNESS / 2 + 0.19;
  const outer = Math.max(width, depth) * 0.39;
  const inner = Math.max(width, depth) * 0.31;
  const spokes = Array.from({ length: 16 }, (_, i) => (i / 16) * Math.PI * 2);
  return (
    <group>
      {spokes.map((a) => {
        const mid = (outer + inner) * 0.5;
        const len = outer - inner;
        return (
          <mesh key={a} position={[Math.cos(a) * mid, y, Math.sin(a) * mid]} rotation={[0, -a, 0]}>
            <boxGeometry args={[len, 0.04, 0.04]} />
            <meshStandardMaterial color={color} roughness={0.18} metalness={0.12} />
          </mesh>
        );
      })}
    </group>
  );
}

function MembraneCords({ width, depth, color }: { width: number; depth: number; color: string }) {
  const radius = Math.max(width, depth) * 0.28;
  const rings = [0.38, 0.7, 1];
  return (
    <group position={[0, 0.12, 0]}>
      {rings.map((r) => (
        <mesh key={`ring-${r}`} rotation={[-Math.PI / 2, 0, 0]}>
          <torusGeometry args={[radius * r, 0.02, 8, 36]} />
          <meshStandardMaterial color={color} roughness={0.2} metalness={0.08} />
        </mesh>
      ))}
    </group>
  );
}

export function Trampoline({
  id,
  position,
  width,
  depth,
  type,
  cant,
  cantAngleRad,
  moveAxis,
  onImpact,
}: TrampolineProps) {
  const rbRef = useRef<RapierRigidBody>(null);
  const meshRef = useRef<Group>(null);
  const membraneRef = useRef<Group>(null);
  const spring = useRef<TrampState>(createTrampState());
  const color = trampColor[type];
  // Canted pads lean toward `cant`: the static tilt that redirects the bounce. Normal =
  // launch direction reported on rebound; euler = the visual lean of the frame.
  const canted = type === "canted" && !!cant;
  const cantN = useMemo(
    () => (canted ? cantNormal(cant, cantAngleRad) : null),
    [canted, cant, cantAngleRad],
  );
  const cantRot = useMemo(
    () => (canted ? cantEuler(cant, cantAngleRad) : null),
    [canted, cant, cantAngleRad],
  );
  const sliderAxis = useMemo(() => {
    const [x, z] = moveAxis ?? [1, 0];
    const m = Math.hypot(x, z);
    return m < 1e-6 ? ([1, 0] as const) : ([x / m, z / m] as const);
  }, [moveAxis]);
  // Per-pad deterministic phase/dir for moving pads (seeded by world position).
  const movePhase = useRef((position[0] * 0.37 + position[2] * 0.91) % (Math.PI * 2));
  // Live lateral slide speed of a moving pad — imparted into the bounce (timing skill).
  const slideVx = useRef(0);
  const slideVz = useRef(0);
  // Fragile pads break shortly after the first impact.
  const breaking = useRef(false);
  const breakTimer = useRef(0);

  // Target spring values (mutated on impact, decays back to 0).
  const target = useRef({ depress: 0, tiltX: 0, tiltZ: 0 });

  // Accumulating goo-splat decal painted onto the membrane top each landing. One Canvas2D
  // texture per pad; impacts smear a colored blob at the (relX,relZ) contact point.
  const splat = useMemo(() => {
    // Tier-driven splat resolution: there's one CanvasTexture per live pad, so mid/low halve it
    // to 64px to cut texture memory across the render window (high keeps 128px crispness).
    const sc = createSplatCanvas(getQuality().splatResolution);
    const texture = new CanvasTexture(sc.canvas);
    // The canvas holds sRGB colors (palette hexes); without this the goo decal renders in
    // linear space — the blue gets crushed to dark muddy rings (worse under ACES tonemapping).
    texture.colorSpace = SRGBColorSpace;
    return { ...sc, texture };
  }, []);
  // Release the GPU texture when the pad unmounts (tower recycles pads as you climb).
  useEffect(() => () => splat.texture.dispose(), [splat]);

  useFrame((_, dt) => {
    const g = meshRef.current;
    if (!g) return;
    const step = Math.min(dt, 1 / 30);
    spring.current = stepTramp(spring.current, target.current, step);
    const depress = spring.current.depress.value; // ≤ 0 on impact

    // Real trampoline: the rigid FRAME stays put; only the MEMBRANE sheet dips inward
    // under the blob's weight and tilts toward the contact, then springs back. (Sinking
    // the whole pad read like the platform dropping, not a flexing membrane.)
    const membrane = membraneRef.current;
    if (membrane) {
      membrane.position.y = THICKNESS / 2 + 0.02 + depress; // dip the sheet in
      // Static cant tilt (canted pads lean permanently toward `cant`) + the dynamic impact
      // flex spring on top, so a canted pad both visibly leans and still flexes on hit.
      membrane.rotation.x = (cantRot?.rotX ?? 0) + spring.current.tiltX.value;
      membrane.rotation.z = (cantRot?.rotZ ?? 0) + spring.current.tiltZ.value;
      // Flatten + widen as it stretches down (a sheet under load), proportional to dip.
      const dip = Math.min(-depress / 5.4, 1); // 0..1
      membrane.scale.set(1 + dip * 0.06, 1 - dip * 0.5, 1 + dip * 0.06);
    }
    target.current.depress *= 0.86;
    target.current.tiltX *= 0.86;
    target.current.tiltZ *= 0.86;

    // Moving pads glide side to side on a kinematic body (collider moves with them) and
    // track their slide velocity so a bounce imparts that lateral momentum (timing skill).
    if (type === "moving" && rbRef.current) {
      movePhase.current += step * movingSpeed;
      const offset = Math.sin(movePhase.current) * movingAmplitude;
      const x = position[0] + sliderAxis[0] * offset;
      const z = position[2] + sliderAxis[1] * offset;
      rbRef.current.setNextKinematicTranslation({ x, y: position[1], z });
      // d/dt of offset: cos(phase)·amp·speed → instantaneous lateral slide speed (m/s).
      const slideSpeed = Math.cos(movePhase.current) * movingAmplitude * movingSpeed;
      slideVx.current = sliderAxis[0] * slideSpeed;
      slideVz.current = sliderAxis[1] * slideSpeed;
    }

    // Fragile pads shrink + fade then vanish ~0.8s after impact.
    if (breaking.current) {
      breakTimer.current += step;
      const k = Math.max(0, 1 - breakTimer.current / 0.8);
      g.scale.setScalar(k);
      g.visible = k > 0.02;
    }
  });

  // Pads recolor with ALTITUDE to match the biome backdrop: their type hue is pulled
  // toward the biome's mid color the higher they are, so high-up pads cool/darken into
  // space alongside the sky. Computed once from the pad's fixed world Y.
  const tinted = useMemo(() => mixHex(color, biomeSkyAt(position[1]).mid, 0.35), [color, position]);
  const emissive = useMemo(() => tinted, [tinted]);
  // Membrane = mostly bright cream but pulled ~45% toward the (height-tinted) pad color so
  // each pad reads its own hue from above (the top face is what the camera mostly sees).
  const membraneColor = useMemo(() => mixHex(palette.cream, tinted, 0.24), [tinted]);
  const railColor = useMemo(() => mixHex(tinted, palette.blob.ink, 0.22), [tinted]);
  const cordColor = useMemo(() => mixHex(palette.cream, tinted, 0.28), [tinted]);

  return (
    <RigidBody
      ref={rbRef}
      type={type === "moving" ? "kinematicPosition" : "fixed"}
      position={[position[0], position[1], position[2]]}
      colliders={false}
    >
      {/* Solid collider for the pad body. */}
      <CuboidCollider args={[width / 2, THICKNESS / 2, depth / 2]} />
      {/* Sensor just above the surface to detect + measure landings. */}
      <CuboidCollider
        args={[width / 2, 0.2, depth / 2]}
        position={[0, THICKNESS / 2 + 0.2, 0]}
        sensor
        onIntersectionEnter={(e) => {
          const other = e.other.rigidBody;
          // Guard against a peer whose handle was invalidated this frame (the render window
          // can unmount a pad's body, and a stale handle would throw on linvel/translation).
          if (!other || other.isValid?.() === false) return;
          const lv = other.linvel();
          // Only react to a descending blob (ignore the upward exit through the sensor).
          if (!lv || lv.y >= 0) return;
          const speed = Math.abs(lv.y);
          const center = rbRef.current?.translation() ?? {
            x: position[0],
            y: position[1],
            z: position[2],
          };
          // Relative hit point on the pad ([-0.5,0.5] each axis) → off-center hits tilt
          // the pad toward the contact, deflecting the bounce (no longer hardcoded 0).
          const bt = other.translation();
          const relX = clamp((bt.x - center.x) / width, -0.5, 0.5);
          const relZ = clamp((bt.z - center.z) / depth, -0.5, 0.5);
          target.current = impactTargets(speed, relX, relZ);
          // Smear a big juicy goo splat on the membrane at the contact point, sized by
          // impact + tinted to the blob's skin. A hard landing throws a wider, multi-blob
          // splat (World-of-Goo splat, not a small dot); accumulates across landings.
          const skin = useGameStore.getState().progress.skin;
          const size = clamp(0.18 + speed / 34, 0.18, 0.55);
          splat.paint(relX + 0.5, relZ + 0.5, palette.blob[skin], size);
          // Hard hits fling a couple of satellite splats around the contact for spread.
          if (speed > 9) {
            splat.paint(relX + 0.5 + 0.12, relZ + 0.5 - 0.08, palette.blob[skin], size * 0.6);
            splat.paint(relX + 0.5 - 0.1, relZ + 0.5 + 0.11, palette.blob[skin], size * 0.5);
          }
          splat.texture.needsUpdate = true;
          reportImpact(speed);
          reportLanding({
            padId: id,
            speed,
            position: [bt.x, center.y + THICKNESS / 2 + 0.2, bt.z],
            relX,
            relZ,
          });
          // Trampoline rebound: bounce back at impact speed × type multiplier (NO minimum
          // floor — a floor made every micro-bounce re-pop at 8 m/s, so the blob bounced
          // forever, never settled into a resting puddle, and the clean-combo ran away as
          // each jitter re-fired this sensor). Below a settle threshold the pad does NOT
          // rebound — the goo comes to rest. Standard pads are slightly springy (>1) so a
          // clean drop sustains the climb; the player's slingshot adds the real energy.
          // `super` bonus pads guarantee a big mega-launch regardless of how gently you
          // land (the treat); all others scale with impact and can settle.
          const reboundSpeed =
            type === "super"
              ? Math.max(speed * reboundMultiplier.super, SUPER_MIN_REBOUND)
              : speed * reboundMultiplier[type];
          if (reboundSpeed >= REBOUND_SETTLE_SPEED) {
            // Canted pads launch along their tilted normal; moving pads tilt the launch
            // toward their slide direction (so timing the catch flings you sideways — the
            // type's real skill); flat pads bounce straight up (normal omitted → up).
            let normal = cantN ?? undefined;
            const slideSpeed = Math.hypot(slideVx.current, slideVz.current);
            if (type === "moving" && slideSpeed > 0.5) {
              // Lateral fraction from the pad's slide speed (capped), up-component fills rest.
              const lateral = Math.max(-0.5, Math.min(0.5, slideSpeed / 12));
              const ux = slideVx.current / slideSpeed;
              const uz = slideVz.current / slideSpeed;
              normal = [ux * lateral, Math.sqrt(Math.max(0, 1 - lateral * lateral)), uz * lateral];
            } else if (type === "wobbler") {
              // Unstable: the pad TIPS toward where you landed, so an off-center hit deflects
              // the bounce that way (risk/reward — hit center for a clean launch). Tilt by the
              // hit offset, scaled to the configured max tilt. Explicitly normalize so the
              // launch speed is never inflated at extreme corner hits / large tilt configs.
              const s = Math.sin(WOBBLER_MAX_TILT);
              const lx = relX * 2 * s;
              const lz = relZ * 2 * s;
              const up = Math.sqrt(Math.max(0.01, 1 - lx * lx - lz * lz));
              const mag = Math.hypot(lx, up, lz) || 1;
              normal = [lx / mag, up / mag, lz / mag];
            }
            reportRebound({ speed: reboundSpeed, type, normal });
            // Impact strength [0,1] brightens the bounce voice — a hard landing sounds sharper.
            playBounce(type, Math.min(1, speed / MAX_IMPACT_SPEED));
          }
          // Fragile pads start disintegrating after this bounce (gives one last launch).
          if (type === "fragile") breaking.current = true;
          onImpact?.(speed, relX, relZ);
        }}
      />
      <group ref={meshRef} position={[0, 0, 0]}>
        {/* Rigid round trampoline frame: a torus hoop + radial laces, not a platform slab. */}
        <TrampolineFrame width={width} depth={depth} color={railColor} />
        <PerimeterLaces width={width} depth={depth} color={cordColor} />
        {/* WET/JELLY membrane (the bounce surface) — tinted toward the pad TYPE color with a
            punchy emissive so each type glows its own hue. Physical material with a clearcoat +
            sheen gives it a wet, jelly-like fresnel sheen that matches the goo blob (was a
            plainer standard material that read dry/plastic). */}
        <group ref={membraneRef} position={[0, THICKNESS / 2 + 0.02, 0]}>
          <mesh>
            <cylinderGeometry
              args={[Math.max(width, depth) * 0.31, Math.max(width, depth) * 0.34, 0.12, 48]}
            />
            <meshPhysicalMaterial
              color={membraneColor}
              emissive={emissive}
              emissiveIntensity={0.5}
              roughness={0.12}
              metalness={0.1}
              clearcoat={1}
              clearcoatRoughness={0.08}
              sheen={0.6}
              sheenColor={emissive}
              sheenRoughness={0.4}
              transparent
              opacity={0.92}
            />
          </mesh>
          <MembraneCords width={width} depth={depth} color={cordColor} />
          {/* Per-type silhouette cue (super frame / booster chevrons / ice slab / fragile cracks
              / wobbler ring / canted arrow) on top of the membrane so the pad KIND reads at a
              glance, not just by color. */}
          <PadTypeDecor type={type} width={width} depth={depth} cant={cant} moveAxis={moveAxis} />
          {/* Accumulating goo-splat decal — a transparent plane skimming the membrane top,
              painted by the Canvas2D splat texture on each landing. */}
          <mesh position={[0, 0.18, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[Math.max(width, depth) * 0.31, 48]} />
            <meshStandardMaterial
              map={splat.texture}
              transparent
              depthWrite={false}
              roughness={0.25}
              metalness={0.1}
              polygonOffset
              polygonOffsetFactor={-1}
            />
          </mesh>
        </group>
      </group>
    </RigidBody>
  );
}
