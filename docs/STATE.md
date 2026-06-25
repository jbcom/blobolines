---
title: State
updated: 2026-06-25
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

- **Menu is its own page (#109)** — `app/Game.tsx` renders a pure-DOM `<LandingPage>` on the menu
  phase (its own purple `--bg`, a breathing DOM hero blob, no WebGL); the game canvas + scene + HUD
  mount only in a run. The menu now owns its background (no longer painted over by the in-game sky)
  and costs nothing on a low-end phone.
- **Predictive mid-air aim arc (#109)** — `<AirAimPreview>` draws a live tube of the blob's
  predicted path (`src/sim/trajectory.projectTrajectory`: current velocity + steering accel +
  gravity) while airborne and steering, so flight corrections are aimed, not guessed.
- **Hands-off lateral settle (#109)** — released air-steer drift gently converges (so the arc eases
  back to center) via a settle gated on `shouldSettleLateral` — a never-steered ballistic hop keeps
  its full launch travel, so the climb-reach proof stays intact.
- **Small-phone scaling fixes (#109)** — air-steer drag thresholds are now viewport-relative
  (`steerConfigForViewport`), and `deviceScale()` no longer enlarges the HUD on small phones (≤1),
  so the readouts stop occluding the play area and aiming is proportional on every screen.
- **Biome identity across four sensory dimensions**, all keyed off the canonical biome bands
  (`src/config/biomes.ts` → `biomeBandAt`): data-driven per-band scenery props
  (`biomePropRegistry`, **6 props/band**), **parallax depth layers** (far/mid/near + a sparse
  **landmark** layer) in `BiomeScenicProps`, per-band **ambient audio beds**, and per-band
  **particle grain** (mote size/drift/tint via `biomeAmbience`).
- **Blob-reactive scenery** — the NEAR parallax props come alive as the blob rushes past: a
  proximity **lean** + scale **pop**, a discrete **flyby pulse** (scale spike at closest approach),
  and an emissive **glint** (warm brighten), all from the pure `sceneryReaction` /
  `flybyPeaked` / `stepFlybyPulse` / `glintEmissive` helpers in `src/render/vfx/sceneryReaction.ts`,
  driven near-layer-only in `ScenicInstance`. Deterministic; no new draw calls.
- **Per-band hero landmarks** — one large signature structure per band (obelisk → great-pine →
  ice-spire → monolith-spire → ringed-planet → gas-giant) on a dedicated slow, far parallax layer
  so each stratum has a memorable monument. `landmark` on `biomePropRegistry`; curated GLBs vetted
  by `scripts/vet-biome-glbs.mjs` (rejects external-texture GLBs that break headless WebGL).
- **Daily "Today's tower" standing** — the GameOver card shows a daily run's placement among the
  player's own prior attempts at today's seed (first climb / "#N of M" / new personal daily best),
  via the pure `dailyStanding` selector in `src/sim/daily/`.
- **Per-biome music** — each canonical band has its OWN upbeat track, resolved by `biomeBandAt` and
  crossfaded like the ambient beds (`setMusicBand` in `src/audio/howler.ts`), so the climb has real
  sonic progression instead of the old binary `ingame`↔`highspace` threshold.
- **Escalating reward moments** — a milestone fanfare now climbs with altitude (bright → triumph →
  epic → mega) off a shared pure `milestoneTierIndex(height)` (the single threshold source for both
  audio + visual), and the `MilestoneBanner` matches it with a tier-scaled label, gold flash, and
  pop (`milestoneVisual`). The difficulty-up stinger escalates by altitude too.
- **Biome-band banner** — a gentle "Entering The Stratosphere"-style note (`BiomeBanner`) on the
  first UP-crossing into a new band, with a soft cue (blue flash + collect chime) that stays
  clear of the difficulty banner's loud gold/milestone moment. Friendly labels come from
  `biomeBandLabel`; the up-crossing test uses `biomeBandIndex` (both in `src/config/biomes.ts`).
- **Treasure jackpot** — a rare top crystal tier (`treasure`) worth a crystal burst with a
  celebratory gold-flash collect + a chest GLB (`TreasureChests`).
- **Achievement-gated cosmetics** — earning an achievement unlocks an exclusive skin
  (`SKIN_ACHIEVEMENT`); the customizer shows "Earn: <achievement>" tiles. Earned skins: ghost
  (Apex Ascent / 25k), ink (Deep Space / 1000m), nebula (Voyager / 2000m), **aurora** (Faithful /
  7-day daily streak — a cool dawn-teal that fills the warm palette's one gap).
- **Daily-streak progression** — *Daily Devotee* (3-day) and *Faithful* (7-day) achievements reward
  consecutive-day daily play (the streak only advances on TODAY'S tower, never a replay). The streak
  is surfaced on the menu's Daily Challenge CTA via the pure `dailyStreakStatus` selector: a 🔥N
  flame badge when alive, a gold "keep your streak!" nudge when AT-RISK (played yesterday, not yet
  today), a check when SECURED. The badge refreshes across a UTC-midnight rollover (visibility +
  heartbeat) so it never goes stale.
- **This-week daily summary** — a 7-day bar chart of daily bests (`weeklyDailySummary`) in the
  Achievements modal, with the week-best day flagged.
- **Complete feel-feedback layer (0.1.14)** — every meaningful moment now has audio + visual +
  tactile payoff: a success haptic on each celebratory peak (max combo, perfect release, treasure
  jackpot, achievement unlock, new record, streak extension); a full goo-splat + heavy haptic on
  death and a relief buzz on a shield save; coin/powerup/success feedback on a customizer purchase;
  and a tap sound on the menu's primary buttons.
- **Accessibility settings** — Reduce motion now suppresses CSS animation, screen flashes, speed
  lines, and punch micro-interactions; High contrast boosts semantic UI surface/text/border tokens
  through the same persisted settings/root-dataset path.
- **Readable high-altitude hazards** — wind gusts and downdrafts already affect the blob in the
  late climb; the HUD now surfaces those active forces with a compact wind/downdraft readout fed by
  the same diagnostics that `PlayerBlob` applies to the body.
- **Complete active power-up badges** — the top-center HUD now surfaces every held modifier,
  including the one-shot shield save, so a player can tell whether they are protected before the
  next fatal fall instead of discovering it only when the save fires.
- **Post-run next-climb goal** — GameOver now selects the nearest incomplete achievement milestone
  and shows it as a compact "Next climb" target, so a result screen turns directly into a replay
  objective without adding another progression currency.
- **Complete How-to-play reference** — the Manual now reflects the shipped run surface, not just
  the original PoC controls: route/radar reading, combo launches, all active power-up types,
  high-altitude hazards, Daily Challenge, and the next-climb goal are covered in one scroll-safe
  modal reference.
- **Small-phone menu action wrap** — the TitleScreen's secondary actions now live in a labelled,
  wrapping menu nav, so Customize, Achievements, Settings, and How to play stay fully visible on a
  320px-wide phone instead of clipping off the viewport edges.
- **Small-phone first-run difficulty fit** — the Play → New game difficulty dialog now keeps all
  six route choices visible at 320px phone width, including Ultimate Blobmare, and the shared Dialog
  primitive truly caps/scrolls its inner panel on short safe-area viewports.
- **Small-phone dense modal fit** — Settings and the Hall-of-Fame leaderboard tab keep their
  primary Done action visible on a 320px touch viewport, even with haptics enabled and a dense
  saved leaderboard. The leaderboard's score list has its own shorter phone cap so it no longer
  creates a nested-scroll trap that hides the dialog action.
- **Short-landscape menu modal action bars** — Settings and Goo Customizer now split their dense
  content into a scroll body with a fixed action footer, so Done remains visible on first open at
  700x320/568x320 short landscape viewports instead of sitting below the initial scroll position.
- **Small-phone dense game-over fit** — a dense daily/new-record result opens at the score summary
  instead of auto-scrolling down to the focused replay button, while Climb again, Share, and Back to
  menu remain visible in a fixed action footer on a 320px touch viewport. The reward/daily detail
  stack scrolls inside the results body instead of moving the whole card.
- **Two-skill onboarding** — the launch coachmark plus a new mid-air **steer** coachmark
  (`SteerCoachmark`) teach both core skills once, in context; a short first hop re-arms the steer
  cue rather than burning the teach.
- **Dev teleport** — jump the Rapier body to any altitude (`requestTeleport` / DevHarness /
  `window.__blobtest.teleport`) for QA across the whole climb.
- **E2E reliability** — specs drive the game via the `window.__blobtest` test bridge (store
  calls, not synthetic clicks) so the Playwright suite is green under CI's SwiftShader software
  GL; the chronic CI E2E red was a 64MB-/dev/shm renderer crash + click stalls, now fixed.

## Next

- Next work should follow the current queue in `.agent-state/directive.md`; start with a fresh
  remaining-work survey and avoid stacking more daily/progression, post-run goal, base cloud-pad,
  power-up badge, how-to reference, small-phone menu action layout, first-run difficulty dialog
  layout, dense Settings/leaderboard modal layout, short-landscape Settings/Customizer action
  reachability, dense GameOver result/action layout, or hazard readability work without new
  evidence. The biome visual identity (scenery + parallax + landmarks + reactions + audio +
  particles + banner), route hazards, and the daily/progression surfaces are already deep.
- Visual QA is via the **deterministic browser fixtures** (real foreground Chromium), NOT live
  teleport screenshots: the claude-in-chrome tab is backgrounded, so rAF is throttled — the
  physics teleport doesn't move the blob and DOM motion animations don't advance. `setHeight(y)`
  drives the HUD readout headless but does not scroll scenery.
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
