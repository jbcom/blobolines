---
title: Architecture
updated: 2026-06-17
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

1. **Sim purity** — `src/sim/**` is pure TS:
   no DOM, no three.js, no `Math.random()` (use `createRng`), no `performance.now()`
   (use the clock facade). Enforced by `.claude/gates.json`.
2. **Render ≠ UI** — DOM UI (`app/views/**`, shadcn) never imports three objects.
   It reads/writes game state through the **store bridge** (`src/state`). R3F scene
   components (`app/scene/**`) render from the store/bridges; they don't own game rules.
3. **Factories own spawning** — entities are created via `src/factories/**`, never
   `world.spawn(...)` ad hoc.
4. **Tokens own the palette** — colors/type/space come from `src/styles/tokens.{css,ts}`.
   Raw hex literals outside `tokens.ts` are banned.

## Package map

### `src/` — engine, sim, content

| Package | Barrel | Responsibility |
|---------|--------|----------------|
| `src/core/math` | ✓ | `createRng` (seedrandom-backed), seed phrases, clock facade, vec/lerp/spring helpers |
| `src/core/types` | ✓ | shared domain types (ids, enums, golden-path proof data) |
| `src/config` | ✓ | all tunables as per-domain JSON + typed barrel (physics/blob/launch/trampoline/collect/goo/world/biomes/audio) |
| `src/sim/physics` | ✓ | Rapier config, collision categories, spring/depress math (pure where possible) |
| `src/sim/blob` | ✓ | blob state: squash/stretch springs, expression state machine (eyes), velocity model |
| `src/sim/cloudPad` | ✓ | pass-through cloud catch/adherence tests and footprint math |
| `src/sim/trampoline` | ✓ | compatibility package for cloud catch spring + tilt model, type behaviors (standard/booster/moving/fragile) |
| `src/sim/launch` | ✓ | route charge→velocity, combo/multiplier, 3D air-steer model |
| `src/world` | ✓ | seeded procedural vertical generator, route difficulty profiles, certified golden-path parabolas |
| `src/engine` | ✓ | fixed-timestep accumulator (`advance`/`createStepLoop`) — deterministic sim stepping |
| `src/audio` | ✓ | Howler.js engine playing the itch.io sample library (config/audio.json); music/ambient/sfx channels |
| `src/render/materials` | ✓ | wet goo material (GooMaterial), eye materials, cloud-pad material reuse |
| `src/render/goo` | ✓ | CSG merge selection (`selectMerges`) and intrinsic body lobes feeding the three-bvh-csg goo union |
| `src/render/vfx` | ✓ | goo splash/launch/trail droplet kinematics, splat |
| `src/state` | ✓ | game store (menu/playing/gameover), settings, persistence bridge |
| `src/platform` | ✓ | Capacitor haptics/orientation/keep-awake/preferences wrappers (web fallbacks) |
| `src/input` | ✓ | @use-gesture unified pointer/touch + keyboard → intents |
| `src/styles` | — | tokens.css / tokens.ts / fonts.css / index.css |
| `src/lib` | ✓ | framework-agnostic utils (cn lives here) |

### `app/` — React + R3F

| Package | Barrel | Responsibility |
|---------|--------|----------------|
| `app/scene` | ✓ | composes small scene components inside `<Canvas>` |
| `app/scene/blob` | ✓ | `<PlayerBlob>` (Rapier body + diagnostics bridge), `<GooCsg>` (three-bvh-csg merged goo), `<BlobActor>` (menu hero), `<BlobEyes>`, `<SplatChunks>`, `<TrajectoryPreview>` |
| `app/scene/trampoline` | ✓ | cloud-pad renderer behind compatibility `<Trampoline>`, `<TrampolineField>` imports |
| `app/scene/world` | ✓ | `<SkyDome>`, `<Lighting>`, `<BiomeProps>`, `<BlobFollowLight>`, `<CrystalField>`, `<PowerUpField>`, `<GoldenRoutePreview>` |
| `app/scene/postfx` | ✓ | `<PostFX>` (N8AO ambient occlusion, bloom, vignette, speed-reactive chromatic) |
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
              │             sim: blob springs, cloud catch depress, launch,
              │             world-gen, collision (Rapier), expression FSM
              │                     │

              ▼                     ▼
   app/scene/* read state via diagnostics bridge → render meshes, goo material, eyes, vfx, postfx
   app/views/* read state via bridge → HUD/menus (shadcn + motion), haptics
```

## Determinism & testing

- Same seed phrase → same world & sim. `createRng(seed)` + clock facade make sim replayable.
- Unit tests (happy-dom): sim/engine/world/launch math.
- Browser fixture tests (Chromium + WebGL): scene components render + screenshot.
- Audio tests: before-init no-op contract (Howler).

See `docs/GAME-DESIGN.md` for mechanics/tuning constants and `docs/TESTING.md` for the
test strategy.
