# `app/scene` — the R3F scene graph

The React Three Fiber components that compose the live 3D game inside `<Canvas>`.
This is the layer that **wires** the pure pieces together: it instantiates the
[`src/render`](../../src/render) materials/VFX, reads [`src/sim`](../../src/sim)
rules, drives Rapier physics, and talks to the world through the
[`src/state`](../../src/state) stores + bridges. Components are small and single-
responsibility — no monolithic scene file.

## Layout

| Path | Owns |
|------|------|
| `GameScene.tsx` | Root composition: lighting, sky, camera rig, world fields, and (only while playing) the `<Physics>` provider + `PlayerBlob`. The menu shows an idling fused-goo hero `BlobActor`. |
| `CameraRig.tsx` | Follows the blob's full x/y/z position, with launch FOV warp and impact shake. |
| `blob/` | `PlayerBlob` (the dynamic Rapier body + frame loop), `GooCsg` (world-space merged goo body + eyes), `BlobActor` (CSG idling hero + squash/stretch/wobble fixtures), `BlobEyes` (procedural expressive eyes), `useDroplets` (splash/launch-burst/trail runtime). |
| `trampoline/` | `Trampoline` (springy pad + membrane + goo-splat decal + impact sensor), `TrampolineField` (bounded sliding render window — see perf note). |
| `world/` | `SkyDome`, `Lighting`, `CrystalField` (one InstancedMesh), `PowerUpField`. |
| `postfx/` | `PostFX` — bloom + vignette + speed-reactive chromatic aberration. |

## Conventions

- **Never re-render per frame.** Per-frame data flows through the diagnostics +
  launch/powerup bridges in `src/state`, read inside each component's `useFrame`.
  React state is for human-cadence changes only.
- **`<Physics>` mounts only while playing.** `PlayerBlob` remounts each run, so its
  reset effect can assume a fresh mount.
- **The trampoline field renders a bounded window** around the blob (perf), keyed by
  stable pad id — see [[blobolines-perf-profile]].
- **Rapier WASM must stay un-pre-bundled** (`optimizeDeps.exclude`) and in the
  single `three` prod chunk, or `<Physics>` suspends forever. See
  [`docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md).

The DOM HUD/menus live in [`app/views`](../views), not here — UI never touches
three objects directly; it goes through the store/bridges.
