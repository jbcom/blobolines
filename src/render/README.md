# `src/render` — three.js materials, goo merge helpers, and VFX (framework-agnostic)

The visual building blocks: custom shaders, CSG goo merge selection, and particle/decal
VFX. These are **plain three.js / pure helpers** — no React. The
R3F components in [`app/scene`](../../app/scene) instantiate and drive them each
frame. Keeping them here (not as JSX) lets us own GPU resource lifecycle and unit-
test the pure parts.

## Subpackages

| Dir | Owns |
|-----|------|
| `materials/` | Custom drei `shaderMaterial`s: `GooMaterial` — the ONE wet goo skin, shared by both the menu hero (BlobActor, fused CSG lobes) and the in-game blob (GooCsg, three-bvh-csg merged mesh). Vertex deform modes (`uWobble` travelling jiggle, `uSag` wet sag, `uLobe`/`uLobeDir` asymmetric bulge) keep it gooey; a tight wet specular + fresnel rim shade it. (The old raymarched `MetaballGooMaterial` was removed when the merged-mesh CSG path replaced it; menu↔play now share one material, so there is no shader divergence to unify.) |
| `goo/` | `selectMerges` (merge.ts) — picks which nearby droplets the CSG path unions into the blob body each frame (by distance/weight), bounded by `goo.csg.maxMerges`. |
| `vfx/` | `droplets.ts` (pure splash / launch-burst / trail spawn + gravity step), `splat.ts` (Canvas2D goo-splat decal painter). |

## Gotchas (learned the hard way)

- **Goo merge inputs are world-space.** `PlayerBlob` reports the live body/droplets through
  diagnostics, and `GooCsg` converts selected droplet offsets into its local merge frame.
  Keep that boundary explicit so the goo never pins to the origin or drifts away from eyes.
- **CSG merge count is bounded.** `selectMerges` caps near-body droplet unions with
  `goo.csg.maxMerges`; far droplets render through `FreeDroplets` instead of entering the
  CSG chain.
- **Hand-built materials aren't auto-disposed by R3F.** The owning component must
  `material.dispose()` on unmount (respawn / skin swap / HMR) to avoid leaking GL
  programs.

See [`docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md) for package boundaries and
[`docs/DESIGN.md`](../../docs/DESIGN.md) for the warm goo/material direction.
