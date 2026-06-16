import type { Rng } from "@/core/math";
import type { Vec3 } from "@/core/types";

/**
 * Goo droplet spawning (pure). On a hard impact the blob flings gooey droplets that arc
 * out and fall — these are unioned into the blob's CSG goo skin near the body and render
 * as free splat particles once they separate. Deterministic given an Rng so the splash
 * is reproducible. No three/CSG here — just the spawn kinematics.
 */

export interface Droplet {
  position: Vec3;
  velocity: Vec3;
  radius: number;
  age: number;
  life: number;
}

export interface SplashConfig {
  /** Droplets per unit of impact strength. */
  countScale: number;
  maxCount: number;
  /** Outward speed range. */
  minSpeed: number;
  maxSpeed: number;
  minLife: number;
  maxLife: number;
}

export const DEFAULT_SPLASH: SplashConfig = {
  countScale: 14,
  maxCount: 18,
  minSpeed: 3,
  maxSpeed: 9,
  minLife: 0.5,
  maxLife: 1.1,
};

/**
 * Spawn a radial burst of droplets from `origin` for an impact of `strength` [0,1].
 * Droplets fly out in a hemisphere biased upward (a splat kicks up off the pad).
 */
export function spawnSplash(
  origin: Vec3,
  strength: number,
  rng: Rng,
  config: SplashConfig = DEFAULT_SPLASH,
): Droplet[] {
  const count = Math.min(config.maxCount, Math.ceil(strength * config.countScale));
  const droplets: Droplet[] = [];
  for (let i = 0; i < count; i++) {
    const theta = rng.range(0, Math.PI * 2);
    const phi = rng.range(0.1, Math.PI / 2); // upward hemisphere
    const speed = rng.range(config.minSpeed, config.maxSpeed) * (0.5 + strength);
    const sinPhi = Math.sin(phi);
    droplets.push({
      position: [origin[0], origin[1], origin[2]],
      velocity: [
        Math.cos(theta) * sinPhi * speed,
        Math.cos(phi) * speed,
        Math.sin(theta) * sinPhi * speed,
      ],
      radius: rng.range(0.12, 0.32) * (0.7 + strength * 0.6),
      age: 0,
      life: rng.range(config.minLife, config.maxLife),
    });
  }
  return droplets;
}

/** Integrate a droplet one step under gravity. Returns the updated droplet, or null if
 *  it has expired. Pure — gravity passed in so it stays testable. */
export function stepDroplet(d: Droplet, dt: number, gravityY: number): Droplet | null {
  const age = d.age + dt;
  if (age >= d.life) return null;
  const vy = d.velocity[1] + gravityY * dt;
  return {
    ...d,
    age,
    velocity: [d.velocity[0], vy, d.velocity[2]],
    position: [
      d.position[0] + d.velocity[0] * dt,
      d.position[1] + vy * dt,
      d.position[2] + d.velocity[2] * dt,
    ],
  };
}
