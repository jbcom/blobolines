/**
 * Central game tuning. All tunables live as data in the per-domain JSON files in this
 * directory (physics / blob / launch / trampoline / collect / goo / world) and are loaded
 * here with types, so balancing is data-driven and modifiers (height, biome, pad type,
 * power-ups) can scale these BASES rather than re-deriving magic numbers in code.
 *
 * Sim/render modules import their domain config from here instead of hardcoding constants.
 * The JSON is the source of truth; the named exports below preserve the old constant names
 * so call sites read cleanly.
 */
import type { BlobSkin, TrampType } from "@/core/types";
import blobCfg from "./blob.json";

export { type BiomeColors, biomeBands, biomeSkyAt } from "./biomes";

import collectCfg from "./collect.json";
import gooCfg from "./goo.json";
import launchCfg from "./launch.json";
import physicsCfg from "./physics.json";
import trampolineCfg from "./trampoline.json";
import worldCfg from "./world.json";

export const physics = physicsCfg as {
  gravity: [number, number, number];
  blob: {
    radius: number;
    restitution: number;
    friction: number;
    linearDamping: number;
    ccd: boolean;
  };
  autoLaunchDelay: number;
  deathFallDistance: number;
  worldBoundXZ: number;
  maxImpactSpeed: number;
};

export const blob = blobCfg as {
  speedStretch: { maxSpeed: number; maxStretch: number };
  impactSquash: { maxFlatten: number };
  puddle: { settleSpeed: number; scale: [number, number, number] };
  deformSpringTau: number;
  wobbleDecayTau: number;
};

export const launch = launchCfg as {
  basePower: number;
  powerPerCharge: number;
  comboStep: number;
  comboStart: number;
};

export const trampoline = trampolineCfg as {
  reboundMultiplier: Record<TrampType, number>;
  cantedTiltRad: number;
  wobblerMaxTiltRad: number;
  superMinRebound: number;
  reboundSettleSpeed: number;
  depressSpring: { stiffness: number; damping: number };
  tiltSpring: { stiffness: number; damping: number };
  fragileBreakSeconds: number;
  movingAmplitude: number;
  movingSpeed: number;
};

export const collect = collectCfg as {
  pickupRadius: number;
  magnetRadius: number;
  magnetPullSpeed: number;
};

export const goo = gooCfg as {
  /** three-bvh-csg merged-mesh goo (the one goo path — no fallback). */
  csg: {
    maxMerges: number;
    blobSegments: number;
    dropletDetail: number;
  };
  splash: {
    countScale: number;
    maxCount: number;
    minSpeed: number;
    maxSpeed: number;
    minLife: number;
    maxLife: number;
  };
};

export const world = worldCfg as {
  initialTarget: number;
  maxRetainedTramps: number;
  maxCrystals: number;
  skinCost: Record<BlobSkin, number>;
};
