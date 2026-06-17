# Continuous Work Directive — blobolines

**Status:** ACTIVE
**Owner:** jbogaty

Build **Blobolines** — a gooey-blob vertical-launch physics arcade game — from the
Gemini PoC (`blobolines-poc.html`, "Neon Launch 3D") as the **minimum baseline**.
Elevate it into a complete, polished, shippable game. Public repo `jbcom/blobolines`,
MIT, GitHub Pages (web) + Android (Capacitor). NO stopping.

## TWO-PHASE DELIVERY (owner decision)
Two distinct spheres of work, two branches — cleaner focus than mixing them:
1. **PHASE 1 — PLAYABLE (branch `feat/foundation`, PR #2).** Make the game actually
   PLAYABLE end-to-end: launch the blob off trampolines, climb, fall/die, score. PROVE
   it in a real HEADED browser via the vitest browser plugin + screenshot capture (read
   the screenshot, confirm gameplay). Then push, address ALL PR feedback (CodeRabbit/
   bots/CI), and SQUASH-MERGE once everything passes green.
2. **PHASE 2 — POLISH (new branch off merged main).** Only after Phase 1 merges: goo
   splash VFX, splat decals, trails, jiggle, audio depth, post-processing, juice,
   content/balance, mobile perf. The deep polish lives here.
Do PHASE 1 first to completion+merge, THEN cut the polish branch. Don't pull polish work
forward into Phase 1 — minimum playable + proven + merged is the Phase-1 bar.

## Core goal (the spine — preserve from the PoC)
The central tension is unchanged: launch your blob AS HIGH AS POSSIBLE up an endless
vertical tower of trampolines. Altimeter, best-height record, combo on clean bounces,
and death when you fall below the level — this height-chase is the game's spine and must
never be lost as we elevate. Everything else (goo, eyes, juice) serves making that climb
feel amazing.

## North star (the fun)
World-of-Goo / ink-blob FLUIDITY. The blob is a deformable gooey body, NOT a rigid
sphere: squash-and-stretch on impact, big colorful gooey splash droplets + splat decals
on every trampoline collision, jiggle/surface-tension wobble, wet goo trails. Without
this messy fluid juice the game misses what makes it fun. Latest-everything; add ANY
library that elevates the game (physics/fluid/VFX/audio) — size is not a concern.

## Goo + physics architecture (DECIDED — see memory blobolines-goo-architecture)
STAY 3D (PoC + cover art are 3D). Rapier (@react-three/rapier) drives the real 3D blob
+ droplet bodies. **three-bvh-csg** is the 3D-native goo skin: reuse one Evaluator,
ADD(union) blob+nearby droplets into a merged goo Brush in-place (batched, no allocs),
SUB splats from pads — no Paper.js→extrude proxy, no fluid-sim (obsolete). Fallback:
drei <MarchingCubes> metaballs. Goo shader + procedural eyes render the merged Brush.

## Phase-1 PLAYABLE: PROVEN (commit e21f9c9)
Game is playable end-to-end: blob rests on pad → drag-slingshot launch → climbs (altimeter
rises) → fall → game over → replay. Proven by e2e/playable.spec.ts against BOTH dev and the
production preview build. Rapier <Physics>-suspension blocker SOLVED (optimizeDeps.exclude
rapier+compat; prod manualChunks keeps rapier in `three` chunk; rapier3d-compat inlines WASM
so no .wasm asset needed). 122 unit + 3 browser + 1 e2e green.
PR #2 feedback: 2 rounds of CodeRabbit/Amazon-Q/Gemini addressed (24 threads resolved):
math-facade guards, Android scaffold (applicationId test + FileProvider scope), trampoline
tilt, button type, dev-harness ?dev key, capture stream errors, persistence logging, brand-
hex gate + full color tokenization. Pillar docs added (GAME-DESIGN/DESIGN/TESTING/DEPLOYMENT).
Trampoline auto-bounce + combo + 3D air-steer wired. Awaiting final CI → SQUASH-MERGE.
Then Phase 2 (polish) on a fresh branch off merged main: goo CSG skin (three-bvh-csg),
splat VFX, jiggle, audio (Tone.js from syntheteria), post-processing, juice, content/balance,
mobile perf, FOV-warp/screenshake, loading screen + favicon, more docs (AGENTS.md + HADS).

## (resolved) Dev harness
Dev harness (app/views/DevHarness; ?dev or DEV
button) fires blob events + auto-writes screenshot + before/after diagnostics JSON to
gitignored artifacts/ via Vite middleware (scripts/capturePlugin.ts) — proven working;
USE IT to verify gameplay headlessly instead of timing manual screenshots.

## What CONTINUOUS means
1. Never stop for status reports the user didn't ask for.
2. Never stop for scope caution.
3. Never stop to summarize — git log is the summary.
4. Never stop for context pressure — task-batch + PreCompact handle it.
5. Never stop because a task feels big — pick the next atomic commit.
6. Only stop on: explicit user halt, red CI blocking, or genuine STOP_FAIL.

## Operating loop — CONTIGUOUS, no pauses, work through the night
while queue has [ ] items: implement → verify (typecheck+lint+test, run the app & READ a
screenshot for visual/UI work) → commit (Conventional Commits) → dispatch pipelined local
review (comprehensive-review:full-review + security-sast + code-simplifier, scoped to the
diff, background) → fold findings forward → mark [x] → IMMEDIATELY next item. Never stop
between packages, never wait idly. While CI/review run in the background, start the next
independent package. If one item is blocked, pick another [ ] item — there is always
parallel work. Milestone boundaries get a broader review pass.
Reference `~/src/arcade-cabinet/{kings-road,marmalade-drops,ebb-and-bloom,will-it-blow,bioluminescent-sea}` for patterns.

### The end of EVERY turn opens the NEXT item — no scheduling crutch
**Banned: ScheduleWakeup / cron / `/loop` self-pacing as a way to "continue later."** Those
are pauses wearing a timer. The contiguous loop runs IN-TURN: finish an item, immediately
start the next one in the same flow of work. The ONLY legitimate yields are the true
blockers (interactive auth, a spend needing approval, real hardware, or remote state I
already triggered — CI/deploy/dispatched-review — watched via Monitor with a heartbeat).
A drained-feeling queue is not a stop: re-run the audit fan-out (review/UI/visual/audio/
perf/game-design agents) to GENERATE the next batch of directives, append them here, and
keep going. The queue is meant to stay long; growing it is part of the work.
Batch into a PR roughly every ~6-10 commits of coherent work, open it, keep building the
next batch on a fresh branch while CI runs — do not idle waiting on CI.

## Not an MVP — the long haul
The goal is a COMPLETE, polished, fun game, not a minimal-visible demo. "It renders"
/ "it builds" / "a blob bounces" is NEVER done. Every milestone aims at depth and
polish (game feel, juice, content, balance, mobile perf, accessibility). Do not
descope toward a thin slice; when a task is done, take the next one that deepens the
game. Keep going through M0→M9 and beyond — there is always a next polish pass.

## Forbidden phrases
"deferred" | "v2+" | "out of scope" | "future work" | "tracked separately" | "follow-up"
"TODO" | "FIXME" | "stub" | "placeholder" | "mock for now" | "MVP" | "good enough for now"

---

## Harvest-first strategy (PRIMARY build method)
~90% of this game is a unique recombination of code that already exists across
~/src/arcade-cabinet/*. COPY proven pieces and adapt them — do NOT build production
structure from scratch. For every subsystem (audio engine, metaball/blob renderer,
Rapier physics setup, R3F scene scaffolding, post-processing stack, shadcn/ui
components, gesture input, test harness, fixture stage, CI), first FIND the best
existing implementation in the cabinet, copy it in, then adapt to Blobolines' tokens,
ECS, and game rules. The harvest map (which game → which subsystem) is in
docs/reference/HARVEST-MAP.md. Recombine into a unique whole; attribute in code
comments where a piece came from. This is faster AND higher quality than greenfield.

## Architecture rule (applies to EVERY item)
Build PROPER subpackages under src/ and app/ per docs/ARCHITECTURE.md package map.
Each package has a barrel index.ts public surface; modules are small, single-
responsibility, real .ts/.tsx. NO monolithic scenes, NO placeholders/stubs — if a
file is committed it works and is tested. Sim pure; render≠UI; factories spawn;
tokens own palette.

## M0 — Repo foundation & scaffold  (DONE pieces marked)
- [x] Scaffold pnpm + Vite 8 + React 19 + TS 6 (package.json all-latest, scripts block)
- [x] Tooling configs: vite.config.ts (base switch Pages/Capacitor + manualChunks), tsconfig(.node).json, biome.json, Tailwind v4 (@tailwindcss/vite), .gitignore
- [x] Design tokens: src/styles/tokens.css + tokens.ts + fonts.css + index.css; self-hosted Fredoka+Nunito woff2 in public/assets/fonts
- [x] capacitor.config.ts (appId com.jbcom.blobolines)
- [x] App shell entry: app/main.tsx, App.tsx (koota WorldProvider + ErrorBoundary)
- [x] docs/ARCHITECTURE.md package map
- [x] shadcn/ui base components in app/components/ui (button, dialog, slider, switch, tabs, tooltip, progress) + barrel; cn() in src/lib
- [x] Vitest dual config + src/__tests__/setup.ts + app/fixtures/FixtureStage + passing unit (tokens) + fixture (SkyDome WebGL) tests
- [x] Capacitor android platform added (`cap add android`); wrappers via src/platform barrel; cap sync confirmed
- [x] release-please config + manifest; .github/dependabot.yml
- [x] CI workflow (lint → tsc → unit → build → playwright install → browser fixtures + screenshot artifacts → Android assembleDebug APK artifact)
- [x] release.yml + cd.yml deploying dist/ to GitHub Pages
- [x] enable Pages via gh (build_type=workflow, base /blobolines/); README done; CHANGELOG pending

## M0.5 — Real foundational subpackages (each = barreled package + tests, one commit)
- [x] src/core/math: createRng (cyrb128→mulberry32), clock facade, spring/lerp helpers + unit tests + barrel
- [x] src/core/types: shared domain types/enums/ids + barrel
- [x] src/ecs: koota world + traits (Transform/Velocity/Blob/Trampoline/Crystal/PowerUp/Particle/Dead) + tests + barrel
- [x] src/engine: fixed-timestep accumulator loop (FIXED_DT 1/60, step-capped, alpha) + unit tests + barrel
- [x] src/state: zustand game store (menu/playing/gameover) + settings + progress + Capacitor-Preferences persistence + barrel
- [x] src/input: pure slingshot/air-steer/keyboard intent math + tests + barrel (React useGesture binding lands in M2 app/hooks)
- [x] src/platform: Capacitor wrappers (haptics/orientation/keep-awake/preferences) + barrel

## M1 — Design system & identity
- [x] Design tokens (color/space/radius/shadow/motion/type) as CSS vars + TS token module + Tailwind theme; juicy gooey palette (Phase 1)
- [x] Unique self-hosted Google Fonts: Fredoka Variable (display) + Nunito Variable (UI), wired to tokens + Tailwind (Phase 1)
- [x] Brand-hex ban_patterns in gates.json (enforced); all render colors tokenized (Phase 1). STANDARDS.md brand section — Phase 2.
- [x] Loading screen (bouncing-blob Suspense fallback), app icon/favicon (public/icon.svg, gooey-eyed blob), web manifest (PWA, portrait fullscreen)

## M2 — Core engine & deterministic sim
- [x] RNG facade + clock facade + unit tests (M0.5)
- [x] Fixed-timestep engine loop (accumulator) + unit tests (M0.5)
- [x] Physics: @react-three/rapier world, gravity, blob rigidbody, fixed trampoline colliders + sensors (WASM-suspension fix proven)
- [x] Camera rig: menu orbit + in-run vertical follow (damped). FOV warp on launch + screen shake — polish, Phase 2.
- [x] Input: @use-gesture slingshot drag → launch impulse (LaunchInput). Air-steer + keyboard binding (pure math done) wired in Phase 2.

## M3 — Gooey blob (the star)
- [x] Blob rendering: dual path — goo-shaded sphere (menu/fixtures) + raymarched metaball goo skin (in-game, GooField + MetaballGooMaterial) that merges blob+droplets
- [x] Squash-and-stretch deformation driven by velocity/impact; springy approach to target scale
- [x] Jiggle / surface-tension wobble secondary motion (vertex-level): uWobble vertex displacement on GooMaterial + wobbleField SDF term on MetaballGooMaterial, impact-driven envelope (browser-verified rippled silhouette)
- [x] Gooey surface shader: fresnel rim, light-wrap, wet specular + shimmer
- [x] Blob skins: all 4 (blue/slime/ghost/ink) wired to store; BlobCustomizer modal (pick/unlock with crystals) on title — verified rendering. (Fixed a real shadcn Dialog bug: Motion can't interpolate calc()↔% transforms — split centering to CSS, animate only opacity/y/scale.)
- [x] **Big expressive blinking eyes** — procedural geometry on the goo face (depthTest-on-top), idle/blink/squint/wide/tear via eyeShape; world-space goo+eye alignment fixed

## M4 — Trampolines & world
- [x] Trampoline entity: spring depress (-k·x - c·v) + tilt on real hit-angle, squishy mesh, auto-bounce
- [x] Platform types defined (standard/booster/moving/fragile) with rebound multipliers; moving/fragile gameplay behaviors — Phase 2
- [x] Procedural vertical world generator (seeded), difficulty curve
- [x] Crystals (instanced, collect, magnet-pull) + power-ups (magnet torus / thruster cone): spawn in world-gen, render, collect, effects (magnet pulls crystals, thruster boosts up), HUD badges, reset on run

## M5 — Goo VFX & juice (the messy fluidity)
- [x] Gooey splash droplet system on every collision (metaball droplets merge into the goo) — replaces PoC cubic sparks
- [x] Splat decals: Canvas2D goo-splat painter wired onto each pad as a per-trampoline CanvasTexture decal plane; accumulating skin-tinted smears on landing (browser-verified)
- [x] Wet goo trail behind blob (distance-throttled droplet wake); launch burst (downward pad kick); combo flame (molten u_heat shader glow, browser-verified)
- [x] @react-three/postprocessing stack: bloom + vignette + chromatic (speed-reactive) + color grade (app/scene/postfx); DOF/N8AO optional Phase 2
- [x] haptics on mobile impacts (impact-scaled Heavy/Medium/Light on landing, setting-gated)
- [x] anime.js + Motion micro-interactions across HUD/menus: usePunchOnChange hook (anime.js elastic punch) on combo badge + crystal counter; Motion entrances retained

## M6 — Audio (Tone.js)
- [x] Tone.js engine (lazy, gain-bus) + bounce/launch/chime/powerup/splat synths, wired into gameplay; no-op-before-init tests
- [x] Procedural ambient music (Tone.js pad drone + plucked Loop sequence) on the music bus; starts on play, stops to menu; volume/music-toggle settings wired (SettingsModal)

## M7 — Game loop, UI, meta
- [x] Game states (menu/playing/gameover) + store; HUD (altimeter, crystals, combo)
- [x] Menus via shadcn + Motion: main menu, game over, blob customizer, settings (volume/music/sensitivity/haptics → store + audio), mechanics manual (how-to-play)
- [x] Persistence (Capacitor Preferences): best height, crystals, settings
- [x] Combo/multiplier + scoring; best-height records. Milestone juice — Phase 2

## M8 — Mobile & ship
- [x] Pages live & app RUNS (Phase 1, screenshot-verified); Android assembleDebug green in CI
- [x] Pixel-5a 60fps perf pass: profiled at 6x CPU throttle — raymarch is cheap (p50 8.3ms); bounded the trampoline render window (was unbounded → climb spikes), p95 158ms→16.9ms. Wobble amp tuned to keep march budget flat.
- [x] Safe-area/touch tuning: Hud safe-bottom inset added; TitleScreen menu buttons given 44px min tap targets (safe-area infra already in place for top/left/right + title bottom)
- [x] Quality pass — a11y: full DOM-UI audit + fixes (names/roles, live regions, reduced-motion, AA contrast, dialog labelling, focus mgmt; canvas aria-hidden) with a11y assertion tests. error states: WebGL context-loss recovery + stale-Rapier-handle guard (ErrorBoundary already existed).

## M9 — Docs (pillar + agentic + HADS)
- [x] Pillar: README, DESIGN, GAME-DESIGN, ARCHITECTURE, TESTING, DEPLOYMENT (CHANGELOG = release-please)
- [x] STANDARDS.md, docs/STATE.md, CONTRIBUTING — present and substantive (verified, not stubs)
- [x] Agentic: AGENTS.md (existed), per-system READMEs (src/sim, src/render, src/state, src/audio, app/scene), .github/copilot-instructions.md, .cursor/rules/blobolines.mdc
- [x] HADS-format docs: docs/reference/ENGINEERING-NOTES.hads.md (AI manifest + [SPEC]/[BUG] blocks capturing verified facts + the real bugs hit this build)

## M10 — "Make it ALIVE" (post-ship fixes; user feedback 2026-06-16)

**Mandate (verbatim):** "no targeting, camera doesn't track the blob (zooms off camera),
much more lifeless and dull vs the cyberpunk PoC, no real use of color (just blue+white),
no deformation physics, no splat. + read the harness screenshots/diagnostics you've been
capturing — close that loop."

**Process fix:** READ artifacts/*.png + *.json after every change (I built capture but never
read it back — write-only loop. That's why I missed all of the above).

**Direction (user decision):** "Juice up the goo look" — keep the gooey daytime aesthetic,
add the PoC's ENERGY (shake, follow-light, bloom, speed FX, color), NOT neon-cyberpunk.

### Queue
- [x] Camera follows the real blob x/y/z (was height-only, X/Z hard-locked) + impact shake — verified in artifacts/launch-up.png (blob now framed).
- [x] Goo deformation in-game: squash/stretch wired into GooField (u_deform/u_center) — verified alive airborne (artifacts/launch-up.png); fixed the teardrop-merge by tightening MERGE_DIST_SQ + pinching off droplets that drop below the body (artifacts/start.png clean).
- [~] Real color: type-tinted trampoline membranes + warm saturated sky DONE (verified); crystal/powerup color + richer grade still open.
- [x] PR #5 merged + deployed live.
- [x] PR #6 (feat/goo-depth) merged + deployed live (splat physics, ice pad, gradient, biome strata).
- [x] Splat: bigger juicier World-of-Goo splat — wider spray (maxCount 28, MAX_GOO_BALLS 32), larger impact-scaled decal + satellite splats on hard hits (verified: large multi-lobe goo covering the pad).
- [x] Aim/targeting feedback: in-scene dotted ballistic trajectory arc while charging (aim bridge + TrajectoryPreview, arc-length spacing) — verified readable aim line.
- [x] Gameplay: off-pad death fixed — death now measured below highest LANDED pad (safeY), not airborne apex; a tall launch lands + survives (verified alt 37m no Splat).
- [x] Juice: BlobFollowLight follows + tints the scene to the blob skin (warms with combo, flashes on impact). (speed-FX/bloom polish still possible later.)

### M10b — deeper feature requests (user feedback 2026-06-16, batch 2)
- [x] Trampoline DEPRESSION: membrane (not the whole pad) now dips inward + tilts + flattens on impact, proportional to force, springs back — reads as a flexing sheet under the blob's weight.
- [x] Backdrop CHANGES with height: SkyDome lerps biome bands (ground→sky→upper-atmo→stratosphere→space→deep-space) from blob altitude (config/biomes.json). Verified ground band; lerp unit-tested.
- [x] Trampoline COLOR by height: pad hue blends toward the biome mid-color with altitude (mixHex), so pads cool/darken into space with the backdrop.
- [x] BONUS trampolines: added the violet SUPER mega-launch pad (guaranteed big boost). More bonus types can follow this pattern.
- [x] Powerup MODELS: rocket (Space Kit) + magnet (U-curve) GLBs from 3DLowPoly → public/assets/models, loaded via useGLTF w/ primitive Suspense fallback (self-contained re-export so no 404).
- [x] WET look: dual-spec + subsurface + translucent wet shader (verified glistening). [next: color gradient]
- [x] BONUS trampolines: added ICE pad (cyan, very bouncy 1.55x but BREAKS the clean-combo — risk/reward) alongside super. Two distinct bonus mechanics now.
- [x] Splat pieces REAL PHYSICS: SplatChunks — a pooled set of Rapier rigid bodies flung from the contact on a hard landing that bounce/roll/settle on pads, then recycle. Verified in harness (chunks scattered + rolled on the pad).
- [x] World STRATA / BIOMES geometry: BiomeProps — instanced drifting clouds (sky bands ~60-560m) + twinkling stars (space 650m+), opacity-faded by altitude so each band reads as a distinct biome alongside the SkyDome color transition.
- [x] Color richness: blob body now has a vertical color GRADIENT (deeper low, brighter top) in the goo shader; crystals cycle 5 gem hues (slime/blue/gold/violet/flame) via per-instance setColorAt (was all green).

### M10c — the blob IS goo, not a globe (user feedback 2026-06-16, batch 3) — HIGH PRIORITY
The single biggest "it's not a blob" issue: right now it's a solid matte-colored GLOBE.
A real Blobolines blob should:
- [x] REST as a happy goo PUDDLE: grounded+slow blends deform toward a wide flat puddle;
  forms back into a blob as it speeds up. Also fixed the runaway auto-bounce (removed the
  rebound floor + settle threshold) so it actually comes to rest. Verified in harness.
  (Still to refine: lift puddle center so it sits ON the pad, not half-sunk.)
- [x] WET GLISTENING surface: dual specular (tight water hotspot + broad lobe + sheen),
  subsurface glow, translucent grazing edges — verified glistening in harness (was matte).
  (Still to refine: an actual color GRADIENT across the body, and drag-direction deform.)
- [x] DEFORM on charge: the resting puddle GATHERS UP (taller, narrower) toward the pull while charging the slingshot, scaled by drag charge — tenses to fling. (Full directional lean toward the finger needs a shear; upward gather is the readable approximation.)
- [x] LAUNCH FORMING: puddle gathers on charge → on release the deform springs to the flight blob shape (speedStretch) as it leaves — puddle→blob handled by the same spring.

### M10d — architecture (user feedback 2026-06-16, batch 4)
- [x] All tunables moved to JSON in src/config, decomposed by domain (physics/blob/launch/
  trampoline/collect/goo/world/biomes) + typed barrel; sim/render read bases so modifiers
  can scale them. Behavior-preserving, 166 tests green.

### M10e — polish refinements (feat/goo-polish-2)
- [x] Puddle sits ON the pad: render center drops by the lost half-height when squashed, so the resting puddle rests on the surface (eyes peek over) instead of half-sunk.
  the puddle rests on the surface (eyes peek over the top), not half-sunk through it.
- [x] PR #7 (feat/goo-polish-2) merged + deployed (puddle sits on pad; cache gitignore).

## All M10 "make it alive" feedback shipped (PRs #5 #6 #7)
Camera follow + shake, in-game deformation, wet glistening shader + color gradient, resting puddle (sits on pad) + charge-gather, aim trajectory, membrane bend, off-pad-death fix, real color + height biome backdrop/strata + pad recolor, GLB powerups, super+ice bonus pads, real-physics splat chunks, juicy splat, blob-follow light, multi-hue crystals, JSON config architecture. Next polish batch (when requested): drag-direction shear deform, biome hazards, more bonus mechanics, audio/FX depth.

## M11 — features polish & improvements (/loop, dynamic)
- [x] Audio: distinct bounce SFX for the super (triumphant 420Hz) + ice (glassy MetalSynth ping) bonus pads — they were both falling to the default standard pitch.
- [x] Real audio: switched Tone.js synth → Howler.js playing the owned itch.io sample library (impact bounces, whoosh launch, explosion splat, UI crystal/powerup, menu theme, wind/magic ambient beds). Cue→file map in config/audio.json; ambient bed swaps sky→space by altitude. Verified Howls load + play in-browser.

## M12 — UI/UX depth (from UI audit, 2026-06-16)
### Tier 1 — game-feel & HUD
- [x] Altitude-milestone celebration: transient "100m/200m…" banner + number-pop + sound on each 100m crossing (Altimeter/Hud).
- [x] ScreenFlash component on the unused --z-flash layer: gold on combo escalation, blue on big launch, red vignette near death (new app/views/hud/ScreenFlash.tsx).
- [x] Escalate ComboBadge by tier: color/glow/size ramp gold→orange→goo.flame, "ON FIRE" state at 5×.
- [x] In-run personal-best flourish: pulse Best line gold + banner when height crosses best mid-run (Altimeter).
- [x] Big-launch/max-charge flourish in LaunchInput: pulse bar + "MAX" label + edge glow near charge 1.0.
- [x] Near-miss danger feedback: escalating red screen-edge pulse + haptic while falling toward death (Hud).
- [x] PowerUpBadges countdown ring/bar per badge (use Progress primitive) instead of binary on/off. (per-badge scaleX countdown bar)
- [x] Replace PowerUpBadges 120ms polling with bridge subscription (exact timing, cheaper render). (single rAF loop reads powerupRemaining for exact timing + imperative bar writes; React state flips only on on/off edge)
### Tier 2 — game-over recap
- [x] GameOver run recap: max combo, crystals this run vs lifetime, delta-to-best (+Nm / Nm short); extend RunStats with maxCombo.
- [x] GameOver Share button (navigator.share + clipboard fallback).
- [x] Real personal-best celebration on GameOver: goo-splat/confetti burst, gold card glow, distinct sound, "+Nm over best". (gold card glow + border, chime on record, "+N m over best" via run.recordDelta captured at commitBestHeight)
- [x] GameOver delta-vs-best progress bar (run height as fraction of best).
- [x] GameOver: crystals → next-skin progress + jump to customizer.
### Tier 3 — onboarding & states
- [x] First-run tutorial overlay: drag-ghost coachmark over LaunchInput, dismiss on first launch (new Onboarding.tsx).
- [x] First-play hint instead of burying how-to behind a menu button. (the Onboarding coachmark IS the first-play hint — shows the controls inline on first run instead of behind the How-to menu button)
- [x] Branded error/boot-failure screen + boundary (Rapier-WASM/Canvas fail → "tap to retry"). (tap-anywhere-to-retry fallback; friendly "graphics engine couldn't start" copy for WebGL/WASM errors)
- [x] LoadingScreen real progress (asset/WASM fraction) not infinite bounce. (honest determinate bar: real fonts.ready checkpoint, eases asymptotically, only hits 100% by unmounting when Suspense resolves — never fakes completion)
- [x] BlobCustomizer empty state when crystals==0 ("collect crystals to unlock goo").
### Tier 4 — customizer/shop
- [x] Clearer locked-tile cost + "need N more" sublabel + affordability progress fill.
- [x] Animate crystal-spend on unlock (header gem deduct + tile pop via usePunchOnChange). (header gem count punches on crystal change)
- [x] Live gooey blob preview per skin in customizer (not a flat swatch). (wet-goo radial-gradient swatch with glossy highlight + shade from palette tokens — reads as a 3D goo droplet without 4 live WebGL canvases on mobile)
- [x] Keyboard/gamepad grid nav for skins (roving tabindex or Tabs). (roving tabindex + arrow-key nav over the 2-col skin grid; a desktop/a11y secondary — mobile is touch-first)
### Tier 5 — settings
- [x] In-app reduced-motion toggle driving MotionConfig. (settings.reducedMotion → MotionConfig reducedMotion "always"/"user", moved into App so it's reactive)
- [x] Reset-progress action (confirm) clearing best/crystals/unlocks. (store.resetProgress + two-step confirm button in Settings)
- [x] Separate SFX volume from music volume. (settings.sfxVolume + setSfxVolume on the Howler SFX channel; persisted + applied at boot)
- [x] Gate/hide haptics control on non-touch; add intensity/test. (TOUCH_CAPABLE gate hides the control on pointer-only devices; a Test button fires a sample impact)
- [x] Slingshot sensitivity drag-to-test preview area. (drag strip under the slider; dot tracks the pointer scaled by sensitivity, snaps home on release)
### Tier 6 — responsive & cohesion
- [x] Device-aware element SCALING (owner feedback 2026-06-16): src/platform/scale facade
      classifies phone/tablet/desktop from viewport min-dim + pointer-coarse (works on web +
      Capacitor webview, no native dep), writes --ui-scale on :root (rebinds on resize); the
      HUD readout row scales by it (phone bigger, desktop baseline). Pure deviceScale unit-
      tested. (viewport+pointer is the right signal on both web & native — chose it over a
      @capacitor/device dep that only gives model/platform, not a usable scale.)
- [x] Hud wide/tall breakpoints: readouts are now ABSOLUTELY anchored to the safe-area corners
      (altimeter top-left, combo top-center, crystals top-right) instead of a full-width flex
      justify-between row that flung them to opposite edges of a wide monitor. Each scales by
      --ui-scale from its own corner origin. Verified live at 1568px wide AND 420px portrait
      (claude-in-chrome) — clean at both. Hud.layout browser fixture asserts the altimeter stays
      in the left third (not stretched center).
- [x] TitleScreen/GameOver respect safe-left/right (+top/bottom on GameOver) via env-inset
      padding, so neither tucks under a landscape notch / rounded corner. Dropped the redundant
      fixed px-6. Desktop layout unchanged (insets 0) — verified live.
- [x] Modal max-height + internal scroll: the shared Dialog primitive now caps its Content to
      the safe viewport height (100dvh − safe-top − safe-bottom − 2rem) and the inner panel
      scrolls internally (min-h-0 + overflow-y-auto + overscroll-contain), so a tall modal
      (Settings/Customizer) on a short/landscape screen never overflows off-screen. Fixed once
      in the primitive → all three modals benefit. SettingsModal fixture asserts the cap +
      scroll container.
- [x] Goo-language pass on DOM chrome: new --radius-goo token (subtly asymmetric corners,
      1.4/1rem alternating) applied to the CTA Button variant so primary buttons read soft-
      bodied/gooey, not hard rounded rects (verified live on the Settings "DONE"). Badges
      already use rounded-full (organic). Folded the UI-polish review's two real bugs:
      (1) dialog Content was `flex` without `flex-col` → the panel's max-h-full never resolved
      so the new max-height scroll silently didn't activate — added flex-col; (2) Button's `cta`
      boolean leaked to the DOM (React unknown-prop warning) → destructured it out. Plus a HUD
      combo max-w-[40vw] cap so a wide high-tier badge can't collide with the corner readouts.
- [x] Consolidate bespoke accent buttons onto the shared Button primitive: added a `cta`
      variant (display font + uppercase + wide tracking — the arcade CTA voice) to button.tsx,
      then migrated all 5 hand-rolled accent CTAs (SettingsModal/ManualModal/BlobCustomizer
      "Done/Got it", GameOver "Climb again" + "Share" as surface) to <Button cta size="lg">,
      and the TitleScreen hero Play to buttonVariants (kept as motion.button for the spring).
      Verified live (PLAY + Settings Done/Reset render identically). One button identity now.
- [x] Squish-stretch on title Play press (the stack is motion, not anime.js): whileTap now
      SQUISHES the button (scaleX 1.08 / scaleY 0.82 — wide+short like pressing a goo blob) with
      a springy overshoot on release, instead of a uniform shrink. Reduced-motion → a plain
      scale 0.97 (no squish).
- [x] Reduced-motion guards on every flourish: App wraps everything in <MotionConfig
      reducedMotion="always"|"user"> (driven by the in-app toggle + OS pref), so all Framer
      motion.* flourishes (HUD pops, banners, card springs) reduce globally. The looping ones
      get explicit STATIC-cue fallbacks: LaunchInput pulse (already), Play squish (plain scale),
      and the Onboarding drag-ghost now parks at the pulled-back position with a ↓ arrow instead
      of a frozen-mid-loop dot. The 3D VFX (LaunchRing, screen flash) are one-shot, not looping.

## M13 — visual/render/VFX depth (from visual audit, 2026-06-16)
### Blobby the protagonist — MORE BLOBBY, less ball (owner feedback 2026-06-16, HIGH PRIORITY)
Blobby reads too much like a deforming sphere. Make it genuinely gooey/fluid with a wide
range of deformation, and give it a MOUTH for expressiveness. (Input note: this is a MOBILE
game — touch/drag is primary; keyboard is a minor desktop-only secondary, don't over-invest.)
- [x] A MYRIAD of deformation possibilities, not just uniform squash/stretch. Now in the goo
      vertex shader (GooMaterial.surfaceDisp), summed into one signed displacement so the
      analytic normal recompute covers them all: (1) TRAVELLING jiggle — the impact ripple
      phase advances along uImpactDir so it sweeps across the body from the contact point, not
      a standing wave; (2) ASYMMETRIC lobe — a soft bulge toward uLobeDir, which wanders on a
      slow Lissajous so the fat side migrates (never a clean sphere, even idle); (3) WET SAG —
      uSag droops the lower hemisphere + bulges the equator, a heavy settled hang. Plus the
      existing directional lean into motion + charge-gather pinch (group-level). GooCsg drives
      sag/lobe off the settle amount (sprung), impact dir off velocity. Covered by GooMaterial
      uniform unit test + a settled-goo browser render fixture. VISUAL SWEEP DONE (claude-in-
      chrome on the dev server, screenshots read): wired the idle deform into the menu hero too
      (BlobActor — it was a static sphere); found + fixed two regressions the screenshots
      revealed — (a) the sag/lobe presented a grazing slab that blew the wet specular to pure
      white → tightened spec exp 48→70, level 1.6→0.9, tinted by goo color; (b) strong menu
      sag/lobe detached the mesh-based eyes from the deformed body → dialed menu sag/lobe to a
      subtle 0.16/0.14 (in-game GooCsg is unaffected — its face counter-scales). In-game blob
      verified as a proper gooey teardrop with registered face.
- [x] Stronger fluid dynamics in the goo skin: surface-tension wobble that propagates +
      overshoots, droplet bulge/pinch at the contact point, a wet sag at rest. (impact wobble
      spikes to 1.6× + overshoots + decays; resting breathe; droplet bulge/pinch via the CSG
      union already; more propagation queued under the deform-modes item.)
- [x] MOUTH for Blobby: procedural BlobMouth (lip + curving corners) driven by mouthShape per
      expression — idle smile, "wheee" open on launch/wide, grimace on hard impact, dread "o"
      near death; depthTest-off on the face, diagnostics-driven like the eyes. (visual sweep
      pending devtools recovery; covered by mouthShape unit + BlobActor browser fixture.)
- [x] Soft fake contact shadow under the blob, scaled by altitude+squash (BlobShadow). (flat alpha disc on groundY, NOT drei ContactShadows — avoids the composer depth conflict; also fixed the dark-ring splat-decal bug: gradient faded to rgba(0,0,0,0) → dark edges; now toTransparent(color))
- [x] ACESFilmic toneMapping + outputColorSpace on Canvas gl; drop the manual soft-clamp hack in metaballGoo. (soft-clamp gone with metaballGoo's deletion; CSG goo uses GooMaterial)
- [x] Wire biome fog into the scene (biomeSkyAt.fog is computed but unused) — fogExp2 by altitude, hides far cutoff.
- [x] Fix camera far plane vs world scale (far:200 clips dome@150 + biomes to 1400m); attach dome to camera or push far.
- [x] Unify the goo shaders — ALREADY UNIFIED: MetaballGooMaterial (the raymarched in-game
      shader) was removed when the three-bvh-csg merged-mesh path replaced it, so menu (BlobActor)
      and in-game (GooCsg) now share the ONE GooMaterial — there is no divergence left. Verified
      no MetaballGoo references remain in code; fixed the stale src/render/README that still
      described two materials + the removed packMetaballField.
- [x] Biome-reactive goo lighting: GooMaterial gained uEnvTint (biome key/sky color) + uEnvLight
      [0,1] uniforms; the lit body color bends toward the biome color on the lit side and the wet
      fresnel rim catches the sky tint. GooCsg drives it from biomeSkyAt(blobY) with the strength
      ramping 0.15→0.7 by ~1400m (warm at ground → cool/moody in space). Menu hero keeps
      uEnvLight=0 (no biome). Verified in-game (resting puddle renders with the tint, no errors);
      uniform unit test updated.
- [ ] Goo refraction: sample backbuffer along normal×fresnel so the blob bends what's behind it (marquee jelly upgrade).
- [x] Thickness-based saturation (Beer-Lambert) — adapted to the CSG path (the raymarch it
      originally referenced was removed): GooMaterial deepens/saturates the body color toward the
      center (low fresnel = looking through more goo = "thicker") and thins it at the grazing
      edge, using (1-fresnel) as a cheap per-fragment path-length proxy. Reads as volumetric
      "depth in the jelly". Verified live (menu blob center now richer than the edge).
- [x] Fake caustics: BlobCaustic — a soft blobby caustic texture (baked once) on an additive,
      skin-tinted disc under the blob that slowly rotates + breathes and brightens as the blob
      nears the pad (gone at altitude), reading as light refracting through the wet goo onto the
      surface. Sits just above the contact shadow. Flat disc, no extra render pass (mobile-cheap).
      Also folded the trail/droplet/thickness review's actionable fixes: BlobTrail now disposes
      its BufferGeometry on unmount (GPU leak) + dropped the dead per-frame computeBoundingSphere;
      FreeDroplets skips droplets within the merge distance (no sphere poking through the goo
      body); Beer-Lambert is now a palette-independent flat darken applied AFTER the biome tint
      (was a *uColor re-multiply that muddied non-blue skins + compounded with the biome stack).
- [x] Render the free droplets: FreeDroplets — an instanced wet-sphere mesh (MeshStandardMaterial,
      glossy, skin-colored) rendering the flung goo droplets so a splash/launch visibly throws
      goo that arcs + falls. Each scales by its remaining life (shrink + dissolve). GooCsg still
      merges the nearest few into the body (those are subsumed by the larger mass, so rendering
      all of them reads correct + avoids fragile mirroring of the merge selection). Mounted in
      PlayerBlob off the same droplet pool. Browser fixture renders flung droplets in WebGL.
- [ ] Controlled drip/stretch strands (teardrop necks) that thin then snap over ~0.2s — the signature WoG look (re-tune smin per-droplet stretch weight).
- [x] Launch burst VFX: LaunchRing — an additive expanding+fading ring blooms at the pad on
      slingshot release (the in-world "pop"), pooled (4 slots, no per-frame alloc), driven off a
      new launch-burst bridge (reportLaunchBurst/consumeLaunchBursts), size+brightness scaled by
      charge. Joins the existing downward goo-droplet burst + the DOM screen flash. Browser
      fixture proves it blooms real pixels on a reported burst. (Radial speed streaks are the
      separate "speed lines" item.)
- [x] Landing impact rings: the LaunchRing pool now also blooms a GOLD ring on touchdown
      (kind:"land", sized by impact strength, gated >0.2 so micro-settles don't ping) — the
      counterpart to the blue launch pop. Reused the ring-burst bridge + pool (grew to 6 slots),
      recolor-by-kind on event. Browser fixture covers both kinds. (Also folded the review fix:
      BlobActor's idle sag/lobe is now guarded `if (!live)` so it can't clobber GooCsg's
      physics-driven sag.)
- [x] Speed lines: SpeedLines DOM overlay — radial white motion streaks (repeating-conic
      gradient masked to a vignette ring, clear center) that fade in above a velocity threshold
      (14→34 m/s) and out at rest, opacity smoothed in a rAF loop reading blob speed off the
      diagnostics bridge (no React re-render). Fully off under prefers-reduced-motion. Browser
      fixture asserts ramp-in at speed + fade-out at rest.
- [x] Continuous tapered trail ribbon: BlobTrail — a ring buffer of recent blob positions
      rebuilt each frame into a camera-facing strip that tapers (wide at the head → pinched tail)
      and fades along its length; additive + depth-write off so it reads as wet light. Color
      IGNITES from the skin tint toward flame (goo.flame) as the combo climbs, so a hot streak
      trails fire. Retracts onto the blob when slow/grounded; only the airborne fast phase shows
      it. The close-range goo-droplet wake is kept (it fuses into the body — a different, good
      effect). Browser fixture builds the ribbon over moving frames. Also folded the VFX review's
      fixes: PowerUpField now orders the aura mesh FIRST (stable child index) so the Suspense
      model swap can't shift model/aura indices; CrystalField's UP const hoisted above use.
- [x] Crystal sparkle glint + collect burst: each gem now TWINKLES (per-instance brightness
      pulse, phase-offset by id, with a sharp sin^8 sparkle spike) baked into its instance color;
      material is toneMapped:false so the peaks pop as glints. On collect, the gem POPS — scales
      out + flashes bright then dissolves over 0.22s (popping map) instead of vanishing instantly.
      Folded the goo-lighting review fix: floored the biome-tinted fresnel rim at 40% of base so
      the wet edge can't be snuffed out in a dark-sky biome (deep-space tops ~#180a30).
- [x] Powerup attract aura/halo + collect flash: each power-up now has a billboarded additive
      halo (type-colored — magnet blue / thruster orange) that pulses and brightens+grows as the
      blob nears (within ~14u), drawing the eye toward the pickup. On collect, the halo BLOOMS
      bright + scales out over 0.3s (the model hides) before the group vanishes — a satisfying
      grab flash. Browser fixture renders a power-up + aura in WebGL.
- [x] Per-biome particle ambience: BiomeProps gained a drifting MOTES layer (36 instanced
      particles) that's always present and recolors by altitude — warm petals at the ground →
      icy-white wind motes in the stratosphere → nebula violet dust in space (eased across band
      crossings). They drift sideways + bob and wrap into the scroll column like the clouds/stars.
      Joins the existing clouds (sky) + stars (space) strata. Verified in-game (no errors, scene
      healthy).
- [x] Per-biome color grade + bloom in PostFX: bloom intensity (0.28→0.78), saturation
      (0.08→0.20) and contrast (0.06→0.20) now ramp with the blob's altitude (ground→space over
      ~700m), driven imperatively off the diagnostics bridge onto the effect refs — warm + soft
      at the ground, brighter-glow + cooler + crisper/moodier up in space. Verified the scene
      renders cleanly through the ref-driven effects.
- [ ] Depth-of-field focused on the blob (quality-gated).
- [x] Sun sprite in the sky bands: SkyDome now renders a billboarded sun (bright cream core +
      soft additive sky-top halo) high toward the warm-shaft origin the dome already paints, so
      the light shafts have a visible source. It billboards to the camera and FADES OUT as the
      blob climbs into space (no sun in the void). Chose a cheap sprite over a postprocessing
      GodRays pass — the dome shader already paints the shafts, so the sprite completes the look
      within the mobile render budget. Verified no errors; in-game upward camera frames it.
- [x] Wet/jelly trampoline membrane: the bounce surface is now MeshPhysicalMaterial with a full
      clearcoat (roughness 0.08) + sheen tinted to the pad's type color + low base roughness, so
      it reads as wet jelly matching the goo blob (was a drier standard material). The existing
      spring depress/tilt IS the impact ripple. Verified in-game (pad renders glossy/wet).
      ALSO fixed a CRITICAL crash I'd just shipped: the per-frame PostFX biome grade used `ref`
      on the @react-three/postprocessing effect components, which crashed the whole Canvas on run
      start ("Converting circular structure to JSON" in the postprocessing reconciler → tap-to-
      retry error screen). Reworked to quantize altitude into GRADE_STEPS bands held in state so
      the effects take their grade via PROPS (changing only on a band crossing) — no refs. The
      live per-frame value (chromatic-aberration offset) still uses the safe mutate-Vector2-prop
      pattern. Verified the game runs cleanly through the grade now.
- [ ] Wet-shaded splat decals (normal/height + specular) instead of flat Canvas2D basic.
- [x] Distinct pad silhouette per type: new PadTypeDecor renders a per-type cue on the membrane
      — super a glowing wireframe FRAME (treasure), booster upward CHEVRONS (flings higher), ice
      a frosty TRANSLUCENT slab (transmission), fragile radiating CRACK lines, wobbler an off-
      kilter RING (unstable), canted a directional ARROW toward its tilt. Cheap line/flat geometry
      built once per pad (disposed on unmount). Reads the pad KIND at a glance, not just by color.
      Also folded the sun/caustic review: the sun sprite now tracks the camera offset (it was at
      a fixed world Y=80 → sank below the horizon ~160m up, long before the 750m fade); caustic
      gets renderOrder=1 so it adds light over the shadow, not under it. (Noted: per-type
      MeshPhysicalMaterial clearcoat+sheen may need shader pre-warm if mobile hitches appear —
      bounded by the render window for now.)
- [ ] Biome environment geometry per stratum (parallax hills/islands/satellites), altitude-windowed (BiomeGeometry).
- [x] Expressive eyes: pupils now DART toward the blob's travel direction (live velocity), so
      the eyes track where it's heading — a strong life cue (clamped within the sclera; menu hero
      stays centered). The eyes already had a glossy sclera + glint highlight and per-expression
      lid shaping (openY blink/squint/wide via eyeShape) + spontaneous blink + tear droplet, so
      this completes the expressive-eyes intent. (Eyebrows would need new geometry — the lid
      openY + mouth curve already carry the per-expression read.)
- [ ] Quality-tier system (src/render/quality.ts): scale raymarch steps, pool sizes, DOF/god-rays/bloom by device/FPS — gate the heavy effects above.
- [ ] Selective (emissive-channel) bloom instead of global luminance threshold — only goo hotspots/flame/crystals/powerups glow.
- [x] Perpetual idle jiggle: a small constant uWobble floor (GooCsg IDLE_WOBBLE=0.12, BlobActor
      0.1) so the goo surface is ALWAYS subtly alive/shimmering, never perfectly still even at
      rest — the impact spike + resting breathe ride on top of it. Both menu hero + in-game blob.

## M14 — audio depth (from audio audit, 2026-06-16)
- [x] Distinct bounce VOICE for ALL pad types: src/audio/padVoice.ts (pure) gives each type a
      sample + pitch + level — booster springs bright (rate 1.22), super lands heavy+loud (0.72,
      1.25×), moving metallic detune, wobbler unstable low, canted a hair bright; ice/fragile
      keep dedicated samples. Re-pitches the owned `bounce` sample instead of needing 6 files.
      playSfx now takes per-play rate+volume (set on the play-id, not the shared Howl).
- [x] Impact-strength → rate+volume scaling: padVoice(type, strength) brightens pitch (~+12%)
      and lifts volume (~+20%) with the hit; Trampoline passes speed/MAX_IMPACT_SPEED into
      playBounce so a hard landing sounds sharper + no two bounces are identical.
- [ ] Round-robin engine (playRandom with no-immediate-repeat) for per-cue variant sets.
- [x] Charged-launch whoosh by power: playLaunch now scales the whoosh by charge (rate
      0.85→1.25, volume 0.7→1.1) — a soft release is a low slow whoosh, a max charge a fast
      bright one (it ignored charge before; PlayerBlob already passes req.charge).
- [x] Combo rising-pitch blip: new playComboBlip(combo) plays the bounce sample pitched up by
      the streak (rate 1+combo·0.06), fired on every clean bounce in PlayerBlob; silent on ice
      (combo resets to 0). Audio test covers both across charge/combo ranges incl. over-cap.
- [x] Combo-milestone fanfare: playComboFanfare (the victory-pack milestone stinger pitched up
      1.25×) fires ONCE the frame a clean streak first hits the cap — the "ON FIRE" milestone.
      (The directive's 5/10/25 assumed a higher cap; MAX_COMBO is 8, so the fanfare marks the
      max-tier on-fire moment — the one milestone that exists.) Test covers it.
- [x] Personal-best stinger on gameover — ALREADY DONE (M12 line above): GameOver fires
      playRecord() exactly once when the run is a record (isRecord, i.e. height/score beat best),
      gated by a ref so re-renders don't replay it.
- [ ] Real game-over death sting (downer + gooey explosion) instead of reusing the splat.
- [x] Powerup expire cue: tickPowerups now returns the powerups that EXPIRED this tick (crossed
      to 0), and PlayerBlob fires playPowerdown (the pickup sample pitched + leveled DOWN) once
      when a buff ends — distinct from the bright pickup cue. New powerupBridge unit test covers
      activate/countdown/expire-once/multi-expire/reset. (A per-type activate loop + magnet sweep
      loop would need new looped samples — left for an audio-sourcing pass; the power-down is the
      high-value distinct cue.)
- [ ] Crystal pickup variation + multi-gather sparkle run (rate per gem); magnet "sweep" loop while active.
- [ ] Near-miss whoosh when passing a pad close at speed without landing.
- [ ] Three music tracks swapped by phase+altitude (menu / in-game / high-space) with crossfade.
- [ ] Expand ambient beds per biome band (forest/wind/strong-wind/space/snow/magic) off biomeSkyAt.
- [ ] UI sounds (hover/click/confirm/cancel/popup/coin) wired to the shadcn overlay.
- [ ] Music ducking (sidechain) under super-bounce/death/milestone — duckMusic(ms) helper.
- [ ] Three-bus mix (music/sfx/ambient/master) with independent enable+volume; retune ambient down to 0.25.
- [ ] Audio thump layer mirroring the Light/Medium/Heavy haptic split.
- [ ] Preload critical cues at startMusic to avoid first-play decode hitch (mobile).

## M15 — game-design depth + CONFIRMED BUGS (from mechanics inventory, 2026-06-16)
### Bugs (do first — real correctness)
- [x] BUG fixed: ComboBadge now shows the real comboMultiplier (was a divergent 0.5 formula); deleted the dead buggy comboLabel.
- [x] BUG fixed: runtime combo increment now clamps to MAX_COMBO (was unclamped).
### Navigability — varied platform cants + shapes (HIGH PRIORITY, owner-decided 2026-06-16)
Right now every trampoline is one shape + one flat angle → climbing is impossible/luck.
DECISION: fix it with DIFFERENT PLATFORM CANTS AND SHAPES + golden-path placement — NOT
permeability (permeable one-way pads rejected by owner).
- [x] Canted/angled trampoline pad type(s): tilt redirects the bounce laterally (cant.ts +
      ReboundRequest.normal + PlayerBlob launches along the normal + membrane leans).
- [x] Varied platform shapes + sizes (not all one rectangle): width/depth already independent;
      added a shape roll (~1 in 4 → long plank or deep beam silhouette) so the tower isn't a
      stack of squares and the footprint changes how you land.
- [x] GOLDEN-PATH placement rules in the world generator: far successors get the previous pad
      canted toward them (forgiving start clamps into reach instead); generator test proves
      every laterally-distant pad has a canted predecessor pointing at it. THE navigability fix.
- [x] CLIMB PROOF (the playability safety net): src/world/reachable.ts models a ballistic
      launch off each pad (its surface normal × the shipped launch speed, under gravity, plus
      the player's mid-air steer budget) and asserts it lands within the next pad's footprint.
      reachable.test.ts proves the WHOLE generated chain is reachable end-to-end across many
      seeds, that every canted pad is load-bearing (its flat self would strand the climb), and
      that the launch reaches. The generator now CANTS exactly when reaches() fails — one
      tuning source (reachable.ts) shared by generator + proof, so they can never drift. This
      replaced the brittle fixed CANT_REACH constant (footprints shrink with altitude, so a
      fixed lateral threshold silently stranded small high pads).
- [x] Better aim/curve control: air-steer now shapes the drag→accel ramp with a response
      curve (DEFAULT_STEER.responseCurve=1.7) — a small drag gives gentle accel for precise
      micro-curving onto a near pad, a big drag commits to the full lean (the "hook" onto a
      far offset pad). Peak accel stays maxAirSpeed so the climb-reachability budget is
      unchanged. Mobile-first (it's the touch/drag air control). Tests: eased finer-than-
      linear near center, monotonic, linear-curve sanity. Complements the canted-layout fix.
### Pad-variety types (owner feedback 2026-06-16 — more platform kinds for navigability + challenge)
- [x] SLIDER pads: the `moving` pad now tracks its live slide velocity (cos(phase)·amp·speed)
      and tilts the rebound normal toward it, so catching it at the right moment flings the
      blob sideways — timing-based skill, the type's real role. Travel from config amp/speed.
- [x] WOBBLER pads: unstable pad type that TIPS toward the hit point — an off-center landing
      deflects the bounce that way (hit center for a clean launch; risk/reward). Tilt scaled
      by hit offset × config wobblerMaxTiltRad, launched via the rebound normal. In TYPE_BAG.
- [ ] [x] CANTED pad type: tilted membrane whose normal redirects the bounce laterally
      (DONE — config cantedTiltRad, src/sim/trampoline/cant, spec.cant, ReboundRequest.normal,
      PlayerBlob launches along the normal, membrane visually leans). Generator placement +
      tests next.

### Mechanics depth
- [x] Real SCORE system: pure computeScore (src/sim/score) weights height·heightPoints +
      crystals·crystalPoints + a GEOMETRIC combo-style bonus (a long clean streak is worth
      disproportionately more than the same total in short streaks). RunStats.score +
      PlayerProgress.bestScore persisted SEPARATELY from bestHeight — a shorter crystal/combo-
      rich run can set a score record without a height record (and the GameOver card celebrates
      EITHER). Score is the headline stat on the game-over card (gold + "+N over best" on a
      score record); share text leads with score. Tunable via config/score.json. Tests: score
      weighting/monotonicity/super-linear-combo unit, store commit (score + separate records),
      GameOver score-record-without-height-record browser fixture.
- [x] Crystal depth — TIERS: common/rare/radiant (worth 1/3/8 crystals, so more score too),
      with rare/radiant odds RISING with altitude (climb is rewarded). src/world/crystalTier.ts
      (pure picker + CRYSTAL_VALUE/CRYSTAL_SCALE); CrystalSpec {position,tier} threaded through
      generator → worldStore → CrystalField (per-tier color: slime/violet/gold, per-tier scale,
      gather awards tier value). Tests: tier value/scale ordering, determinism, mostly-common,
      rarer-with-altitude, generator emits valid tiers. (Consumable/upgrade SINKS beyond skins
      are a separate economy item — left for the powerups/economy pass.)
- [x] Altitude-weighted pad type distribution: src/world/padType.ts blends per-type weights
      across altitude bands (safe standard-heavy start → full toolkit mid → richer bonus/skill
      mix high; standard's share thins as it gets harder, wobbler/super weighted in only up
      top). Replaces the flat TYPE_BAG rng.pick. Pure + deterministic; never rolls canted (the
      generator promotes those for reachability). The climb-proof sweep still passes against the
      new mix. Tests: determinism, no-canted, low=mostly-standard, super/wobbler altitude gating,
      standard-share-thins-with-altitude.
- [x] Make the `moving` pad meaningful — DONE by the SLIDER work above: the moving pad tracks
      its live slide velocity and tilts the rebound normal toward it, so catching it at the
      right phase flings the blob sideways (timing-based skill). Its low rebound multiplier is
      intentional — the value is the lateral launch, not vertical pop. (Use case satisfied; not
      a separate mechanic.)
- [ ] Hazards: add at least 2 (e.g. crumbling gap, spike pad, wind gust, drifting obstacle) gated by biome/height.
- [ ] More powerups beyond magnet/thruster: shield/second-life, slow-mo, score-doubler, multi-bounce; allow stacking or distinct refresh.
- [ ] Comeback/revive mechanic on death (watch-style or one-shot shield) for run length.
- [x] Difficulty curve beyond pad-shrink: vertical SPACING now widens with altitude (+0→3m
      base by y=600, capped under the flat-launch clearance so the climb proof still passes);
      TYPE MIX already altitude-weighted (pickPadType) and CRYSTAL tiers altitude-gated
      (crystalTier). Gravity is deliberately NOT varied — it's a global Rapier constant; per-
      height gravity would fight determinism + the reachability model for marginal gain.
      Crystal/powerup spawn density is uniform-by-design (the tier/type weighting carries the
      progression); revisit only if playtest shows the high tower feels sparse.
- [ ] Daily-challenge seed plumbing (Rng is seedable; add a daily seed + leaderboard-ready run hash).
- [ ] Missions/objectives/achievements layer (e.g. "reach 200m", "10-combo", "100 crystals").
- [ ] Charge-time/overcharge nuance on the slingshot (hold penalty or perfect-release window).
- [ ] Wire walls/misses to break combo if that's the intended rule (docs claim it; runtime only breaks on ice).

## M16 — perf/architecture/quality (from perf audit, 2026-06-16)
### More confirmed bugs
- [x] BUG fixed: resetBridges() clears launch/aim/rebound/splat/steer/impact on run start (PlayerBlob mount) — no stale value firing next run.
- [x] BUG fixed: worldStore.reset derives the next seed via LCG from the previous (was performance.now) — deterministic/replayable; explicit seed still honored. Tested.
### Quality tier (biggest mobile gap)
- [ ] Runtime quality-tier system (low/med/high) in store.settings → DPR, raymarch steps, postfx passes, shadows, AA, pool/particle counts. Expose in SettingsModal.
- [ ] Make raymarchSteps a uniform (u_maxSteps loop bound), not a compile-time #define, so tiers scale without rebuild.
- [ ] Drive Canvas dpr from tier (mid/low → [1,1.5]); gate antialias off on mid/low.
- [ ] Gate PostFX passes by tier (strip bloom + chromatic on low); gate shadows off low/mid + set explicit shadow-mapSize.
### Hot-path / alloc
- [ ] packMetaballField: write into caller-owned scratch buffers each frame instead of allocating Vec3[]+number[] (the one real per-frame GC offender).
- [ ] GooField: set palette colors on change only, not every frame.
- [ ] BlobEyes: cache lid/pupil/tear refs instead of per-frame traverse()+startsWith.
- [ ] PowerUpField: skip collected entries (live-only list), no distance calc for hidden.
- [ ] BiomeProps: early-out the star pass on opacity<0.01 like clouds.
- [ ] metaball fieldNormal: forward-difference (4 evals) instead of central (6) to cut normal cost ~33%.
- [ ] Instance/share trampoline geometry+materials (per-type), keep only splat texture per-pad; 64px splat on mobile.
### Dead code / deps
- [ ] Remove koota ECS (src/ecs/** + WorldProvider + koota dep) — 100% dead (nothing spawns/queries), OR migrate per-frame data into it. Fix ARCHITECTURE.md drift.
- [ ] Remove src/engine/loop.ts (zero importers; references a non-existent hook). Keep core/math/clock.
- [ ] Drop unused deps: maath, n8ao, three-bvh-csg, three-mesh-bvh (zero imports). Fix ARCHITECTURE.md N8AO claim.
### Audio/asset loading
- [ ] html5:true for music+ambient Howls (stream, not full-decode); keep html5:false for short SFX.
- [ ] Preload SFX Howls on LoadingScreen behind the gesture unlock (no first-play hitch).
- [ ] Re-encode theme.mp3 smaller (~96kbps mono / shorter loop) and/or lazy-load post-interaction.
### Bundle/build
- [ ] Lazy-load heavy modals (Manual/BlobCustomizer/Settings) + defer Rapier Physics chunk to first PLAY; address the large three chunk vs masking with chunkSizeWarningLimit.
### Tests
- [ ] Perf-regression e2e: Playwright frame-time budget over a scripted climb.
- [ ] Broaden e2e: powerups, magnet collect, fragile/moving/super/ice pads, combo streak, gameover→retry remount, WebGL context-restore.
