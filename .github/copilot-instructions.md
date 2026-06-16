# GitHub Copilot instructions — Blobolines

Blobolines is a gooey-blob vertical-launch physics arcade game: React Three Fiber +
Rapier (3D), goo rendered as a raymarched metaball isosurface, shipped to GitHub
Pages (web) and Android (Capacitor).

**The full contract is [`AGENTS.md`](../AGENTS.md) — read it first.** This file is a
short pointer for Copilot; AGENTS.md, [`STANDARDS.md`](../STANDARDS.md), and
[`docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md) are authoritative.

## Must-follow essentials

- **pnpm only** (`pnpm dev` / `pnpm build` / `pnpm test` / `pnpm test:browser` /
  `pnpm lint` / `pnpm typecheck`). Never npm/yarn.
- **Biome** for lint+format. No ESLint/Prettier.
- **Conventional Commits**, squash-merge via PR. Never commit to `main` directly.
- **No stubs / TODO / placeholder.** Committed code works and is tested.
- **Design tokens own the palette** — no raw hex in `src/render/**`, `app/scene/**`,
  `app/views/**`, `src/sim/**`. Use `src/styles/tokens.ts` / `tokens.css`.

## Architecture in one breath

- `src/` — pure deterministic sim (`src/sim`, no three/DOM, no `Math.random()` → use
  the seeded `Rng` in `src/core/math`), `src/render` (three materials/goo/vfx),
  `src/state` (zustand stores + imperative per-frame bridges), `src/audio` (Tone.js).
- `app/` — React entry, the R3F `<Canvas>` scene (`app/scene/**`), and the DOM HUD/
  menu overlay (`app/views/**`, shadcn + Motion + anime.js).
- **Never re-render per frame** — per-frame data flows through the diagnostics/launch/
  powerup bridges in `src/state`, read inside each component's `useFrame`.

## Before you commit

`pnpm lint && pnpm typecheck && pnpm test && pnpm test:browser && pnpm build` must
all pass. Render/UI changes need a visual/fixture test (commit-gate enforces this).
Each subsystem has a `README.md` — keep it aligned when you touch the system.
