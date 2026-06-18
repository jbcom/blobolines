# Review Scope

## Target

The **entire blobolines codebase** — a gooey-blob vertical-launch physics arcade game built with React Three Fiber + Rapier, shipped to GitHub Pages (web) and Android (Capacitor).

## Files

~16,446 lines of TypeScript/TSX across two top-level source trees plus governance/config:

### `src/` — engine, deterministic sim, ECS, factories (115 files, ~7,372 lines)
- `src/sim/**`, `src/engine/**`, `src/core/**` — pure deterministic sim (no DOM, no `Math.random()`, no `performance.now()`)
- `src/ecs/**` — koota ECS
- `src/factories/**` — entity spawning
- `src/world/generator.ts` — world/tower generation
- `src/render/materials/gooMaterial.ts`, shaders — goo rendering
- `src/audio/howler.ts` (344 lines), `src/audio/sfx.ts` — Howler audio
- `src/state/store.ts`, `src/state/launchBridge.ts` — state + renderer↔UI bridge
- `src/config/**`, `src/input/**`, `src/platform/**`, `src/lib/**`, `src/types/**`

### `app/` — React entry, R3F Canvas/scene, postfx, shadcn DOM UI (107 files, ~9,074 lines)
- `app/scene/blob/**` — PlayerBlob (492 lines), GooCsg (396 lines), BlobActor, droplets, splat
- `app/scene/world/**` — biome geometry/props, powerups, sky, shadows
- `app/scene/trampoline/**` — trampoline pads
- `app/scene/postfx/**` — N8AO, post-processing
- `app/views/**` — GameOver, SettingsModal, BlobCustomizer, HUD, DevHarness
- `app/components/ui/**` — shadcn primitives
- `app/hooks/**` — game loop, keyboard steer

### Governance / config / CI
- `package.json`, `vite.config.ts`, `capacitor.config.ts`, `tsconfig.*`, `biome.json`, `playwright.config.ts`, `vitest*.config.ts`, `release-please-config.json`
- `.github/workflows/{ci,release,cd}.yml`
- `.claude/gates.json` (determinism ban-patterns + coverage rules)
- Root docs: README, AGENTS, CLAUDE, STANDARDS, CONTRIBUTING, CHANGELOG, `docs/**`

### Test surface
- 81 test files: vitest happy-dom unit, vitest Chromium browser/fixture, Playwright e2e, visual screenshot fixtures

## Flags

- Security Focus: no
- Performance Critical: no (but game is render-budget-bound on mid-tier mobile — perf is materially relevant)
- Strict Mode: no
- Framework: React Three Fiber + Rapier + Capacitor (Vite/TS) — auto-detected

## Review Phases

1. Code Quality & Architecture
2. Security & Performance
3. Testing & Documentation
4. Best Practices & Standards
5. Consolidated Report
