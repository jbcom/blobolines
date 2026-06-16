# AGENTS.md — operating guide for AI contributors

Machine-facing protocols for working the Blobolines codebase. Human overview is in
`README.md`; this file is the extended contract. (CLAUDE.md loads the user's profile
system; this AGENTS.md is the repo-local, tool-agnostic version.)

## What this is

Blobolines — a gooey-blob vertical-launch physics arcade game. R3F + Rapier (3D), goo
rendered as a raymarched metaball isosurface, shipped to GitHub Pages (web) + Android
(Capacitor). The PoC (`docs/reference/`) is the floor; the goal is a complete, polished,
fun game.

## Golden rules

- **pnpm only.** No npm/yarn. No `package-lock.json`/`yarn.lock`.
- **Biome** for lint+format (`pnpm lint` / `pnpm format`). No ESLint/Prettier.
- **Conventional Commits**, squash-merge via PR. Never commit to `main` directly.
- **No stubs / TODO / placeholder / "later".** If it's committed, it works and is tested.
- **Latest-everything**, modernize past breaking changes; don't pin older for convenience.
- **Tokens own the palette** — no raw hex in `src/render/**`, `app/scene/**`, `app/views/**`,
  `src/sim/**` (enforced by `.claude/gates.json`); use `src/styles/tokens.ts`.

## Architecture (see docs/ARCHITECTURE.md)

- `src/` = engine, deterministic sim, ECS, factories, math/RNG facade, audio, render
  materials/vfx/goo, state, content. Each subpackage has a barrel `index.ts`.
- `app/` = React entry, R3F `<Canvas>` scene (`app/scene/**`), DOM UI overlay
  (`app/views/**`, shadcn + Motion).
- **Boundaries:** `src/sim`/`src/engine` are pure (no DOM/three; no `Math.random()` →
  `createRng`; no `performance.now()` → clock facade). UI ↔ game only through the store
  bridge (`src/state`) — UI never touches three objects.
- **Coordinate space:** the goo metaball shader raymarches in WORLD space, so metaball
  centers fed to it MUST be world-space (see `src/render/goo/metaballField.ts` — a prior
  local-space bug pinned the goo to the origin).
- **Determinism:** same seed → same world & sim (replayable). Fixed-timestep engine.

## Commands

```sh
pnpm dev            # vite dev (use /?dev for the dev harness)
pnpm build          # tsc --noEmit + vite build
pnpm typecheck
pnpm lint / format
pnpm test           # vitest unit (happy-dom)
pnpm test:browser   # vitest Chromium fixtures (WebGL) — needs `pnpm exec playwright install chromium`
pnpm test:e2e       # Playwright — the "is it playable?" gate
pnpm android:debug  # build + cap sync + assembleDebug
```

## Verifying gameplay (do this for any render/physics change)

1. `pnpm dev`, open `http://localhost:5173/?dev`.
2. Enter a run via the **PLAY button** (not only the harness) — PLAY is the user gesture
   that unlocks audio and reliably starts physics. The dev-harness `start run` reseeds
   the world each press (starter view may be off-camera; not a bug).
3. Use the **DEV harness** to fire blob events (launch/skin/game-over). Each fire
   auto-writes a scene screenshot + before/after diagnostics JSON to `artifacts/` (via
   the Vite `/__capture` + `/__diagnostics` middleware in `scripts/capturePlugin.ts`).
   Read `artifacts/*.json` for deterministic blob position/velocity/height — don't rely
   on screenshot timing.
4. Confirm the e2e gate (`pnpm test:e2e`) still passes.

## Gotchas

- **Rapier WASM:** keep `@react-three/rapier` + `@dimforge/rapier3d-compat` in
  `optimizeDeps.exclude` AND in the single `three` manualChunk — splitting them breaks
  the WASM init (Physics suspends forever).
- **Vite 8 = rolldown:** `manualChunks` must be a function, not an object.
- **Eyes draw over the opaque goo** via `depthTest:false` + high `renderOrder`.
- Per-frame visual state flows through the diagnostics bridge (`src/state/diagnostics`),
  not React state — don't `setState` in `useFrame`.

## Continuous work

`.agent-state/directive.md` is the live queue (M0–M9). Two-phase delivery: Phase 1
(playable) shipped to main; Phase 2 (`feat/goo-polish`) is deep polish. Work
contiguously; verify → commit → review → next.
