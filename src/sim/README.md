# `src/sim` — pure gameplay simulation

Deterministic, side-effect-free game logic. **No three.js, no React, no DOM, no
Rapier** — just math over plain data. This keeps the rules unit-testable in
isolation (happy-dom) and replayable from a seed. The render layer (`app/scene`)
and physics (Rapier) read from / drive these functions; they never live here.

## Subpackages

| Dir | Owns |
|-----|------|
| `blob/` | Squash-stretch from velocity/impact (`speedStretch`, `impactSquash`, `combineScale`) and the eye-expression FSM (`classifyExpression`). |
| `trampoline/` | Spring depress/tilt model (`stepTramp`, `impactTargets`), rebound multipliers per pad type. |
| `launch/` | `launchVelocity` — slingshot charge + direction + combo → launch velocity. |
| `collect/` | Crystal magnet pull + collection radius. |
| `combo/` | Clean-bounce streak / multiplier rules. |
| `physics/` | Tuning **constants** (`GRAVITY`, `BLOB`, `MAX_IMPACT_SPEED`, `DEATH_FALL_DISTANCE`, `WORLD_BOUND_XZ`) — the single source of truth shared by sim + Rapier setup. |

## Rules

- **Purity is enforced.** No imports from `three`, `@react-three/*`, `react`, or
  browser globals. The commit-gate bans them here.
- **Determinism.** Any randomness flows through a seeded `Rng` from
  [`@/core/math`](../core/math) passed in as an argument — never `Math.random()`.
- **Constants live in `physics/config.ts`**, not scattered in render code, so the
  visual layer and the simulation agree on one set of numbers.

See [`docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md) for how sim, render, and
state fit together.
