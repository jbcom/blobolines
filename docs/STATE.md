---
title: State
updated: 2026-06-16
status: current
domain: context
---

# Blobolines — Current State

## Shipped (Phase 1, on `main`, live)

The game is **playable and live** at https://jonbogaty.com/blobolines/
(jbcom.github.io/blobolines/ redirects there). Loop: hold-charge launch → climb (altimeter)
→ trampoline auto-bounce + clean-bounce combo → 3D mid-air steering → fall → game over →
replay. Rapier 3D physics, deterministic seeded sim, design-token system, shadcn+Motion
UI, persistence, CI/CD (incl. Android debug APK), e2e "is it playable" gate.

## In progress (Phase 2, branch `feat/goo-polish`)

- **Goo skin** — three-bvh-csg merged goo body (`GooCsg`) with wet shader, deformation,
  droplets, and expressive eyes. ✅
- **Splash / splat / trail** — impact droplets, physical splat chunks, pad splat decals,
  launch rings, and wet airborne trail. ✅
- **Audio** — Howler sample library with per-pad bounce voices, music, altitude ambience,
  stingers, and volume buses. ✅
- **Post-processing** — N8AO, bloom, grade, vignette, and speed-reactive chromatic. ✅
- **Crystals + power-ups** — instanced crystals, magnet/thruster/shield/slowmo/doubler/
  multi-bounce pickups, HUD badges, and 3D models/fallbacks. ✅
- **Pad behaviors** — standard, booster, moving, fragile, super, ice, canted, and wobbler
  pads with reachability guarantees. ✅

## Next

- Continue balance and feel passes with real browser playthroughs: pad spacing, rebound
  strength, air-steer sensitivity, hazard pressure, and altitude pacing.
- Keep screenshot/diagnostic reads in the loop for camera framing, blob readability, and
  3D spatial awareness.
- Track upstream dependency warnings separately from app-owned warnings; do not hide console
  noise by suppressing real app errors.

## Key facts for contributors

- Enter a run via **PLAY** to verify (reliable physics + audio gesture); the dev-harness
  `start run` reseeds each press. Read `artifacts/*.json` for deterministic blob state.
- The in-game goo body follows diagnostics in world space; avoid parenting it under the
  Rapier body unless the world-space CSG alignment is preserved.
- Rapier must stay un-pre-bundled + in the `three` chunk (WASM init).
