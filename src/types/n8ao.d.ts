// n8ao ships no type declarations. This types the N8AOPostPass surface we use (the
// pmndrs/postprocessing-compatible AO pass). Kept minimal — extend if we use more config.
declare module "n8ao" {
  import type { Pass } from "postprocessing";
  import type { Camera, Color, Scene } from "three";

  interface N8AOConfiguration {
    aoRadius: number;
    distanceFalloff: number;
    intensity: number;
    color: Color;
    halfRes: boolean;
    gammaCorrection: boolean;
  }

  export class N8AOPostPass extends Pass {
    constructor(scene: Scene, camera: Camera, width: number, height: number);
    configuration: N8AOConfiguration;
    setQualityMode(mode: "Performance" | "Low" | "Medium" | "High" | "Ultra"): void;
    setSize(width: number, height: number): void;
    dispose(): void;
  }

  export class N8AOPass extends N8AOPostPass {}
}
