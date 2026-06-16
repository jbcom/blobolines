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
between packages, never schedule a politeness wakeup, never wait idly. While CI/review run
in the background, start the next independent package. If one item is blocked, pick another
[ ] item — there is always parallel work. Milestone boundaries get a broader review pass.
Reference `~/src/arcade-cabinet/{kings-road,marmalade-drops,ebb-and-bloom,will-it-blow,bioluminescent-sea}` for patterns.

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
- [ ] [WAIT] open PR for this batch → CI green + threads → squash-merge.
