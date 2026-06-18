import type { Vec3 } from "@/core/types";

export interface BodyLobeInput {
  time: number;
  settled: number;
  velocity: Vec3;
  radius: number;
  aimCharge: number;
  aimDirection?: Vec3 | null;
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
  aimDirection,
  idleSeconds,
  excitement,
}: BodyLobeInput): BodyLobe[] {
  const settle = clamp01(settled);
  const charge = clamp01(aimCharge);
  const excited = clamp01(excitement);
  const [vx, vy, vz] = velocity;
  const h = Math.hypot(vx, vz);
  const aimH = aimDirection ? Math.hypot(aimDirection[0], aimDirection[2]) : 0;
  const useAim = charge > 0.01 && aimDirection;
  const wanderX = Math.cos(time * 0.55);
  const wanderZ = Math.sin(time * 0.55);
  const dirX = useAim && aimH > 0.05 ? aimDirection[0] / aimH : h > 0.2 ? vx / h : wanderX;
  const dirZ = useAim && aimH > 0.05 ? aimDirection[2] / aimH : h > 0.2 ? vz / h : wanderZ;
  const aimLift = useAim ? clamp01((aimDirection[1] + 0.1) / 1.1) * charge : charge * 0.25;
  const aimReach = useAim ? charge * (0.34 + Math.min(aimH, 1) * 0.26) : charge * 0.18;
  const impatience = clamp01((idleSeconds - 2.2) / 3.2);
  const breathe = Math.sin(time * (1.7 + impatience * 1.1)) * (0.04 + excited * 0.05);
  const burble = Math.sin(time * 4.8 + idleSeconds * 0.7) * 0.04 * (settle + excited);
  const impatientPulse =
    Math.max(0, Math.sin(time * (3.8 + impatience * 2.6) + idleSeconds * 0.9)) * impatience;
  const impatientTwitch =
    Math.sin(time * (6.1 + impatience * 2.2) + idleSeconds * 1.4) * impatience;
  const twitchOffset = impatientTwitch * radius * 0.04;
  const launchStretch = clamp01(Math.max(0, vy) / 28);

  return [
    {
      position: [
        Math.cos(time * 0.7) * radius * (0.52 + impatientPulse * 0.08),
        -radius * (0.22 + settle * 0.14 - excited * 0.06 - impatientPulse * 0.08),
        Math.sin(time * 0.52) * radius * (0.42 + impatientPulse * 0.08),
      ],
      scale: [
        radius * (0.56 + settle * 0.16 + breathe + impatientPulse * 0.05),
        radius * (0.36 + settle * 0.08 + excited * 0.1 + impatientPulse * 0.16),
        radius * (0.52 + settle * 0.16 - breathe * 0.5 + impatientPulse * 0.04),
      ],
    },
    {
      position: [
        -dirZ * radius * (0.72 + charge * 0.12 + impatience * 0.16) + twitchOffset,
        radius * (0.08 + launchStretch * 0.12 + burble + impatientPulse * 0.24),
        dirX * radius * (0.72 + charge * 0.12 + impatience * 0.16) - twitchOffset,
      ],
      scale: [
        radius * (0.32 + impatience * 0.08),
        radius * (0.42 + excited * 0.12 + impatientPulse * 0.18),
        radius * (0.32 + impatience * 0.08),
      ],
    },
    {
      position: [
        dirX * radius * (0.78 + aimReach + excited * 0.12 + impatience * 0.12),
        radius *
          (0.14 +
            charge * 0.08 +
            aimLift * 0.38 +
            excited * 0.16 +
            impatientPulse * 0.22 -
            burble * 0.5),
        dirZ * radius * (0.78 + aimReach + excited * 0.12 + impatience * 0.12),
      ],
      scale: [
        radius *
          (0.44 +
            charge * 0.18 +
            Math.min(aimH, 1) * charge * 0.14 +
            excited * 0.06 +
            impatientPulse * 0.08),
        radius * (0.44 + launchStretch * 0.16 + aimLift * 0.16 + excited * 0.12),
        radius *
          (0.44 +
            charge * 0.18 +
            Math.min(aimH, 1) * charge * 0.14 +
            excited * 0.06 +
            impatientPulse * 0.08),
      ],
    },
  ];
}
