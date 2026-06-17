import { describe, expect, it } from "vitest";
import { GooMaterial } from "../gooMaterial";

// The goo skin's deformation is driven entirely through these uniforms (GooCsg writes them
// each frame). Guard that the myriad-deform contract exists with sane resting defaults — a
// renamed/dropped uniform would silently flatten Blobby back into a clean sphere.
describe("GooMaterial deform uniforms", () => {
  it("exposes every gooey deform-mode uniform", () => {
    const m = new GooMaterial() as unknown as {
      uniforms: Record<string, { value: unknown }>;
    };
    for (const key of [
      "uWobble",
      "uSag",
      "uLobe",
      "uLobeDir",
      "uImpactDir",
      "uTime",
      "uWet",
      "uEnvTint",
      "uEnvLight",
    ]) {
      expect(m.uniforms[key], `missing uniform ${key}`).toBeDefined();
    }
  });

  it("rests undeformed: wobble/sag/lobe start at zero-ish so nothing pops on mount", () => {
    const m = new GooMaterial() as unknown as {
      uniforms: Record<string, { value: number }>;
    };
    expect(m.uniforms.uWobble.value).toBe(0);
    expect(m.uniforms.uSag.value).toBe(0);
    expect(m.uniforms.uLobe.value).toBe(0);
  });

  it("has a unit-ish default lobe + impact direction (no NaN normalize in the shader)", () => {
    const m = new GooMaterial() as unknown as {
      uniforms: Record<string, { value: { x: number; y: number; z: number } }>;
    };
    const lobe = m.uniforms.uLobeDir.value;
    const imp = m.uniforms.uImpactDir.value;
    expect(Math.hypot(lobe.x, lobe.y, lobe.z)).toBeGreaterThan(0);
    expect(Math.hypot(imp.x, imp.y, imp.z)).toBeGreaterThan(0);
  });
});
