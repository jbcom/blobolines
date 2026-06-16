import { goo as gooCfg } from "@/config";
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

export const DEFAULT_SPLASH: SplashConfig = gooCfg.splash;

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

/**
 * Spawn a downward-biased burst at launch — the blob kicks goo *off the pad* as it pops,
 * so the splat trails beneath the leaving body (opposite bias to {@link spawnSplash}).
 * `charge` [0,1] scales count + speed. Deterministic given an Rng.
 */
export function spawnLaunchBurst(
  origin: Vec3,
  charge: number,
  rng: Rng,
  config: SplashConfig = DEFAULT_SPLASH,
): Droplet[] {
  const count = Math.min(config.maxCount, Math.ceil((0.4 + charge) * config.countScale));
  const droplets: Droplet[] = [];
  for (let i = 0; i < count; i++) {
    const theta = rng.range(0, Math.PI * 2);
    const phi = rng.range(0.1, Math.PI / 2); // measured from straight-down
    const speed = rng.range(config.minSpeed, config.maxSpeed) * (0.5 + charge);
    const sinPhi = Math.sin(phi);
    droplets.push({
      position: [origin[0], origin[1], origin[2]],
      velocity: [
        Math.cos(theta) * sinPhi * speed,
        -Math.cos(phi) * speed, // downward kick
        Math.sin(theta) * sinPhi * speed,
      ],
      radius: rng.range(0.12, 0.3) * (0.7 + charge * 0.6),
      age: 0,
      life: rng.range(config.minLife, config.maxLife),
    });
  }
  return droplets;
}

/**
 * Emit a single short-lived wet-goo droplet trailing the blob, with a small jitter
 * opposite its travel direction so it lags into a wake. `speed` is the blob's current
 * speed [units/s]; the caller throttles emission by distance so the trail is even.
 * Deterministic given an Rng.
 */
export function spawnTrailDroplet(origin: Vec3, dir: Vec3, speed: number, rng: Rng): Droplet {
  // Lag the droplet behind the blob and scatter it slightly off the travel line.
  const jitter = 0.6;
  return {
    position: [
      origin[0] + rng.range(-jitter, jitter) * 0.3,
      origin[1] + rng.range(-jitter, jitter) * 0.3,
      origin[2] + rng.range(-jitter, jitter) * 0.3,
    ],
    velocity: [
      -dir[0] * speed * 0.15 + rng.range(-jitter, jitter),
      -dir[1] * speed * 0.15 + rng.range(-jitter, jitter),
      -dir[2] * speed * 0.15 + rng.range(-jitter, jitter),
    ],
    radius: rng.range(0.14, 0.26),
    age: 0,
    life: rng.range(0.35, 0.6),
  };
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
