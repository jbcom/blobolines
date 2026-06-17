import type { Vec3 } from "@/core/types";

export interface BodyLobeInput {
  time: number;
  settled: number;
  velocity: Vec3;
  radius: number;
  aimCharge: number;
  idleSeconds: number;
  excitement: number;
}

export interface BodyLobe {
  position: Vec3;
  scale: Vec3;
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

/**
 * Persistent CSG lobes fused into the main body. These are not particles: they are intrinsic
 * mass that makes the blob read as goo even with no splash droplets present.
 */
export function bodyLobes({
  time,
  settled,
  velocity,
  radius,
  aimCharge,
  idleSeconds,
  excitement,
}: BodyLobeInput): BodyLobe[] {
  const settle = clamp01(settled);
  const charge = clamp01(aimCharge);
  const excited = clamp01(excitement);
  const [vx, vy, vz] = velocity;
  const h = Math.hypot(vx, vz);
  const dirX = h > 0.2 ? vx / h : Math.cos(time * 0.55);
  const dirZ = h > 0.2 ? vz / h : Math.sin(time * 0.55);
  const impatience = clamp01((idleSeconds - 2.2) / 3.2);
  const breathe = Math.sin(time * (1.7 + impatience * 1.1)) * (0.04 + excited * 0.05);
  const burble = Math.sin(time * 4.8 + idleSeconds * 0.7) * 0.04 * (settle + excited);
  const launchStretch = clamp01(Math.max(0, vy) / 28);

  return [
    {
      position: [
        Math.cos(time * 0.7) * radius * 0.52,
        -radius * (0.22 + settle * 0.14 - excited * 0.06),
        Math.sin(time * 0.52) * radius * 0.42,
      ],
      scale: [
        radius * (0.56 + settle * 0.16 + breathe),
        radius * (0.36 + settle * 0.08 + excited * 0.1),
        radius * (0.52 + settle * 0.16 - breathe * 0.5),
      ],
    },
    {
      position: [
        -dirZ * radius * (0.72 + charge * 0.12 + impatience * 0.1),
        radius * (0.08 + launchStretch * 0.12 + burble),
        dirX * radius * (0.72 + charge * 0.12 + impatience * 0.1),
      ],
      scale: [
        radius * (0.32 + impatience * 0.04),
        radius * (0.42 + excited * 0.12),
        radius * (0.32 + impatience * 0.04),
      ],
    },
    {
      position: [
        dirX * radius * (0.78 + charge * 0.18 + excited * 0.12),
        radius * (0.14 + charge * 0.18 + excited * 0.16 - burble * 0.5),
        dirZ * radius * (0.78 + charge * 0.18 + excited * 0.12),
      ],
      scale: [
        radius * (0.36 + charge * 0.12 + excited * 0.06),
        radius * (0.44 + launchStretch * 0.16 + excited * 0.12),
        radius * (0.36 + charge * 0.12 + excited * 0.06),
      ],
    },
  ];
}
