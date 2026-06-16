# `src/render` — three.js materials, goo field, and VFX (framework-agnostic)

The visual building blocks: custom shaders, the metaball goo field packer, and
particle/decal VFX. These are **plain three.js / pure helpers** — no React. The
R3F components in [`app/scene`](../../app/scene) instantiate and drive them each
frame. Keeping them here (not as JSX) lets us own GPU resource lifecycle and unit-
test the pure parts.

## Subpackages

| Dir | Owns |
|-----|------|
| `materials/` | Custom drei `shaderMaterial`s: `GooMaterial` (the wet goo-shaded sphere — squash + vertex wobble for the menu hero blob) and `MetaballGooMaterial` (the raymarched smin-metaball isosurface for the in-game blob, with combo-flame `u_heat` and surface-tension `u_wobble`). |
| `goo/` | `packMetaballField` — packs the blob body + live droplets into the **world-space** metaball uniform arrays the raymarch shader reads. |
| `vfx/` | `droplets.ts` (pure splash / launch-burst / trail spawn + gravity step), `splat.ts` (Canvas2D goo-splat decal painter). |

## Gotchas (learned the hard way)

- **Metaball centers are WORLD-space.** The fragment shader raymarches from the
  hull's world surface, so `packMetaballField` must pack world-space centers —
  packing hull-local offsets pinned the whole field to the origin (goo on the
  floor, eyes floating). See `goo/metaballField.ts`.
- **GLSL comments must not contain backticks** — the shader lives in a JS template
  literal; a backtick in a comment terminates the string and breaks the build.
- **The raymarch step is shortened while wobble is active** (`stepScale`) — the
  wobble term raises the field's Lipschitz constant above 1, so a full sphere-trace
  step would overstep and punch holes. Amplitude is tuned to stay safe at
  `MAX_STEPS=48`. See [[blobolines-perf-profile]] for the budget.
- **Hand-built materials aren't auto-disposed by R3F.** The owning component must
  `material.dispose()` on unmount (respawn / skin swap / HMR) to avoid leaking GL
  programs.

See [`docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md) and the goo decision in
[`docs/reference/HARVEST-MAP.md`](../../docs/reference/HARVEST-MAP.md).
