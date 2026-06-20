---
title: State
updated: 2026-06-20
status: current
domain: context
---

# Blobolines — Current State

## Shipped (on `main`, live)

The game is **playable and live** at https://jonbogaty.com/blobolines/
(jbcom.github.io/blobolines/ redirects there). Loop: hold-charge launch → climb (altimeter)
→ cloud catch/adherence + clean-catch combo → 3D mid-air steering + air-nudge redirect → fall
→ game over → replay. Rapier 3D physics, deterministic seeded sim, design-token system,
shadcn+Motion UI, persistence, CI/CD (incl. Android debug APK).

Core systems shipped: the merged goo body (`GooCsg`, wet shader + deformation + droplets +
eyes), splash/splat/trail VFX, the Howler audio library (per-pad bounce voices, music,
ambient beds, stingers, buses), the postfx stack (N8AO, bloom, grade, vignette, speed
chromatic), crystals + power-ups (magnet/thruster/shield/slowmo/doubler/multi-bounce), the
full cloud-pad behaviour set with reachability guarantees + catch adherence, the local
leaderboard + achievements gallery, and real-time air-nudge + achievement toasts.

## Recently shipped (biome + progression richness)

- **Biome identity across four sensory dimensions**, all keyed off the canonical biome bands
  (`src/config/biomes.ts` → `biomeBandAt`): data-driven per-band scenery props
  (`biomePropRegistry`), **parallax depth layers** (far/mid/near) in `BiomeScenicProps`,
  per-band **ambient audio beds**, and per-band **particle grain** (mote size/drift/tint via
  `biomeAmbience`).
- **Biome-band banner** — a gentle "Entering The Stratosphere"-style note (`BiomeBanner`) on the
  first UP-crossing into a new band, with a soft cue (blue flash + collect chime) that stays
  clear of the difficulty banner's loud gold/milestone moment. Friendly labels come from
  `biomeBandLabel`; the up-crossing test uses `biomeBandIndex` (both in `src/config/biomes.ts`).
- **Treasure jackpot** — a rare top crystal tier (`treasure`) worth a crystal burst with a
  celebratory gold-flash collect + a chest GLB (`TreasureChests`).
- **Achievement-gated cosmetics** — earning an achievement unlocks an exclusive skin
  (`SKIN_ACHIEVEMENT`); the customizer shows "Earn: <achievement>" tiles.
- **Dev teleport** — jump the Rapier body to any altitude (`requestTeleport` / DevHarness /
  `window.__blobtest.teleport`) for QA across the whole climb.
- **E2E reliability** — specs drive the game via the `window.__blobtest` test bridge (store
  calls, not synthetic clicks) so the Playwright suite is green under CI's SwiftShader software
  GL; the chronic CI E2E red was a 64MB-/dev/shm renderer crash + click stalls, now fixed.

## Next

- Continue richness + feel passes: per-biome music layers, interactive props that react to the
  blob, biome-reactive blob tinting. Use the teleport tool to QA each upper band's look.
- Keep screenshot/diagnostic reads + the e2e bridge in the loop for camera framing, blob
  readability, and 3D spatial awareness.
- Track upstream dependency warnings separately from app-owned warnings; never hide console
  noise by suppressing real app errors.

## Key facts for contributors

- Drive the game in tests/QA via `window.__blobtest` (dev-only, tree-shaken from prod):
  `startRun` / `launchUp` / `gameOver` / `teleport(y)` / `setHeight(y)` / `altitude` / `phase`.
  `setHeight(y)` drives the run height readout (what the altimeter + biome/difficulty banners
  watch) without moving the physics body — for QA of altitude-reactive HUD. E2E specs use it
  instead of clicking DevHarness buttons (synthetic clicks stall under software GL).
- The in-game goo body follows diagnostics in world space; avoid parenting it under the
  Rapier body unless the world-space CSG alignment is preserved.
- Rapier must stay un-pre-bundled + in the `three` chunk (WASM init).
- Curated GLBs must be self-contained (no external texture refs) — an external `colormap.png`
  reference fails to decode under headless Chromium and broke CI; verify with a grep for
  `Textures/` / `colormap` / `image/png` before committing a new model.
