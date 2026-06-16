---
title: State
updated: 2026-06-16
status: current
domain: context
---

# Blobolines — Current State

## Shipped (Phase 1, on `main`, live)

The game is **playable and live** at https://jonbogaty.com/blobolines/
(jbcom.github.io/blobolines/ redirects there). Loop: slingshot launch → climb (altimeter)
→ trampoline auto-bounce + clean-bounce combo → 3D mid-air steering → fall → game over →
replay. Rapier 3D physics, deterministic seeded sim, design-token system, shadcn+Motion
UI, persistence, CI/CD (incl. Android debug APK), e2e "is it playable" gate.

## In progress (Phase 2, branch `feat/goo-polish`)

- **Goo skin** — raymarched metaball isosurface (`GooField` + `MetaballGooMaterial`) that
  merges the blob body with impact splash droplets; eyes drawn on the goo face. ✅ in-game.
- **Splash droplets** (`src/render/vfx/droplets`) + **splat painter** (`vfx/splat`). ✅
- **Audio** — Tone.js SFX (bounce/launch/chime/powerup/splat), wired. ✅
- **Post-processing** — bloom + grade + vignette + speed-reactive chromatic. ✅
- **Crystals** — instanced, bob/spin, auto-collect, magnet-ready. ✅

## Next

- Wire splat decals onto pads; goo trail; combo/launch burst VFX.
- Power-ups (magnet, hyper-thrust) as entities; moving/fragile pad behaviors.
- Blob skin customizer UI; settings/manual modals (shadcn + Motion); ambient music.
- anime.js + haptics micro-juice; Pixel-5a 60fps perf pass (metaball budget).
- Loading screen + favicon/app icon; remaining docs (per-system READMEs, HADS).

## Key facts for contributors

- Enter a run via **PLAY** to verify (reliable physics + audio gesture); the dev-harness
  `start run` reseeds each press. Read `artifacts/*.json` for deterministic blob state.
- Goo metaball centers must be **world-space** (see `src/render/goo/metaballField.ts`).
- Rapier must stay un-pre-bundled + in the `three` chunk (WASM init).
