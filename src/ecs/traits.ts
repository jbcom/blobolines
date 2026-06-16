import { trait } from "koota";
import type { EyeExpression, PowerUpType, TrampType } from "@/core/types";

/**
 * koota ECS traits — the components entities are composed from. Kept data-only and
 * sim-friendly (plain numbers/strings); systems in src/sim operate on them, factories
 * in src/factories attach them, and render components in app/scene read them.
 */

/** World-space position. */
export const Transform = trait({ x: 0, y: 0, z: 0 });

/** Linear velocity. */
export const Velocity = trait({ x: 0, y: 0, z: 0 });

/** Marks the player blob and carries its expressive + squash state. */
export const Blob = trait({
  radius: 0.85,
  /** 1 = round; <1 squashed along impact normal. */
  squash: 1,
  airborne: true,
  expression: "idle" as EyeExpression,
});

/** A trampoline platform with its spring/tilt animation state. */
export const Trampoline = trait({
  type: "standard" as TrampType,
  width: 6,
  depth: 6,
  /** Vertical depression offset (spring value). */
  depress: 0,
  depressVel: 0,
  tiltX: 0,
  tiltZ: 0,
  breaking: false,
  breakTimer: 0,
});

/** A collectible crystal. */
export const Crystal = trait({ collected: false });

/** A floating power-up. */
export const PowerUp = trait({ type: "magnet" as PowerUpType });

/** A short-lived goo/particle entity. */
export const Particle = trait({
  vx: 0,
  vy: 0,
  vz: 0,
  age: 0,
  life: 1,
  color: 0xffffff,
});

/** Tags an entity for removal at end of frame. */
export const Dead = trait();
