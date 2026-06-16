---
title: Architecture
updated: 2026-06-16
status: current
domain: technical
---

# Blobolines — Architecture

Blobolines is a gooey-blob vertical-launch physics game on React Three Fiber +
Rapier, shipped to GitHub Pages (web) and Android (Capacitor). The codebase is
split into **`src/` (engine + sim + content, framework-light)** and **`app/`
(React/R3F views + DOM UI)**. Every subpackage exposes a **barrel `index.ts`** as its
public surface; modules stay small and single-responsibility — no monolithic scenes.

## Hard boundaries

1. **Sim purity** — `src/sim/**`, `src/engine/**`, `src/systems/**` are pure TS:
   no DOM, no three.js, no `Math.random()` (use `createRng`), no `performance.now()`
   (use the clock facade). Enforced by `.claude/gates.json`.
2. **Render ≠ UI** — DOM UI (`app/views/**`, shadcn) never imports three objects.
   It reads/writes game state through the **store bridge** (`src/state`). R3F scene
   components (`app/scene/**`) render ECS/state; they don't own game rules.
3. **Factories own spawning** — entities are created via `src/factories/**`, never
   `world.spawn(...)` ad hoc.
4. **Tokens own the palette** — colors/type/space come from `src/styles/tokens.{css,ts}`.
   Raw hex literals outside `tokens.ts` are banned.

## Package map

### `src/` — engine, sim, content

| Package | Barrel | Responsibility |
|---------|--------|----------------|
| `src/core/math` | ✓ | `createRng` (cyrb128→mulberry32), clock facade, vec/lerp/spring helpers |
| `src/core/types` | ✓ | shared domain types (ids, enums, AABB) |
| `src/engine` | ✓ | fixed-timestep loop (accumulator), world tick orchestration |
| `src/ecs` | ✓ | koota world, traits, queries, react hooks |
| `src/sim/physics` | ✓ | Rapier config, collision categories, spring/depress math (pure where possible) |
| `src/sim/blob` | ✓ | blob state: squash/stretch springs, expression state machine (eyes), velocity model |
| `src/sim/trampoline` | ✓ | trampoline spring + tilt model, type behaviors (standard/booster/moving/fragile) |
| `src/sim/launch` | ✓ | slingshot aim→velocity, combo/multiplier, 3D air-steer model |
| `src/world` | ✓ | seeded procedural vertical generator, difficulty curve |
| `src/factories` | ✓ | spawn blob / trampoline / crystal / powerup / particle entities |
| `src/audio` | ✓ | Tone.js engine: synths (bounce/launch/chime/powerup), ambient pad, bus |
| `src/render/materials` | ✓ | metaball goo material, eye materials, trampoline material |
| `src/render/shaders` | ✓ | GLSL (metaball density field, fresnel/wet goo, splat) |
| `src/render/vfx` | ✓ | goo splash burst, splat-decal texture painter, trail |
| `src/state` | ✓ | game store (menu/playing/gameover), settings, persistence bridge |
| `src/platform` | ✓ | Capacitor haptics/orientation/keep-awake/preferences wrappers (web fallbacks) |
| `src/input` | ✓ | @use-gesture unified pointer/touch + keyboard → intents |
| `src/styles` | — | tokens.css / tokens.ts / fonts.css / index.css |
| `src/lib` | ✓ | framework-agnostic utils (cn lives here) |

### `app/` — React + R3F

| Package | Barrel | Responsibility |
|---------|--------|----------------|
| `app/scene` | ✓ | composes small scene components inside `<Canvas>` |
| `app/scene/blob` | ✓ | `<BlobActor>`, `<BlobEyes>` (procedural sclera+rim+pupil) |
| `app/scene/trampoline` | ✓ | `<Trampoline>`, `<TrampolineField>` |
| `app/scene/world` | ✓ | `<SkyDome>`, `<Lighting>`, `<Ambiance>` (rings/grid/clouds) |
| `app/scene/vfx` | ✓ | `<GooSplash>`, `<SplatDecals>`, `<BlobTrail>` |
| `app/scene/postfx` | ✓ | `<PostFX>` (bloom, vignette, chromatic, N8AO, color grade) |
| `app/views` | ✓ | DOM overlay: `<HudOverlay>`, `<MainMenu>`, `<GameOver>`, modals |
| `app/components/ui` | ✓ | shadcn primitives (button, dialog, slider, switch, tabs, tooltip, progress) |
| `app/hooks` | ✓ | React glue hooks (useGameLoop, useInput, useHaptics) |
| `app/fixtures` | ✓ | `<FixtureStage>` isolated render harness for visual tests |

## Data flow (one frame)

```
input (gesture/keyboard) → intents → src/state
              │
   app/hooks/useGameLoop → engine.tick(dt)  (fixed timestep accumulator)
              │                     │
              │             sim: blob springs, trampoline depress, launch,
              │             world-gen, collision (Rapier), expression FSM
              │                     │
              │                  ECS world (koota) updated
              ▼                     ▼
   app/scene/* read ECS/state → render meshes, goo material, eyes, vfx, postfx
   app/views/* read state via bridge → HUD/menus (shadcn + motion), haptics
```

## Determinism & testing

- Same seed → same world & sim. `createRng(seed)` + clock facade make sim replayable.
- Unit tests (happy-dom): sim/engine/factories/world/launch math.
- Browser fixture tests (Chromium + WebGL): scene components render + screenshot.
- Audio-graph tests: Tone.js node wiring.

See `docs/GAME-DESIGN.md` for mechanics/tuning constants and `docs/TESTING.md` for the
test strategy.
