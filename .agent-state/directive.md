# Continuous Work Directive — blobolines

**Status:** ACTIVE
**Owner:** jbogaty

Build **Blobolines** — a gooey-blob vertical-launch physics arcade game — from the
Gemini PoC (`blobolines-poc.html`, "Neon Launch 3D") as the **minimum baseline**.
Elevate it into a complete, polished, shippable game. Public repo `jbcom/blobolines`,
MIT, GitHub Pages (web) + Android (Capacitor). One initial commit on a feature branch,
then continuous forward commits. NO stopping.

## North star (the fun)
World-of-Goo / ink-blob FLUIDITY. The blob is a deformable gooey body, NOT a rigid
sphere: squash-and-stretch on impact, big colorful gooey splash droplets + splat decals
on every trampoline collision, jiggle/surface-tension wobble, wet goo trails. Without
this messy fluid juice the game misses what makes it fun. Latest-everything; add ANY
library that elevates the game (physics/fluid/VFX/audio) — size is not a concern.

## What CONTINUOUS means
1. Never stop for status reports the user didn't ask for.
2. Never stop for scope caution.
3. Never stop to summarize — git log is the summary.
4. Never stop for context pressure — task-batch + PreCompact handle it.
5. Never stop because a task feels big — pick the next atomic commit.
6. Only stop on: explicit user halt, red CI blocking, or genuine STOP_FAIL.

## Operating loop
while queue has [ ] items: implement → verify (typecheck+lint+test, run the app & READ a
screenshot for visual/UI work) → commit (Conventional Commits) → dispatch pipelined local
review (comprehensive-review:full-review + security-sast + code-simplifier, scoped to the
diff, background) → fold findings forward → mark [x] → next. Milestone boundaries get a
broader review pass. Reference `~/src/arcade-cabinet/{kings-road,marmalade-drops,ebb-and-bloom,will-it-blow,bioluminescent-sea}` for patterns.

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
- [ ] shadcn/ui base components in app/components/ui (button, dialog, slider, switch, tabs, tooltip, progress) + barrel; cn() in src/lib (done)
- [ ] Vitest dual config done — add src/__tests__ helpers + app/fixtures/FixtureStage barrel + first passing example tests (unit + fixture)
- [x] Vitest dual config + src/__tests__/setup.ts + app/fixtures/FixtureStage + passing unit (tokens) + fixture (SkyDome WebGL) tests
- [ ] Capacitor android platform added; haptics/screen-orientation/keep-awake wired via src/platform barrel (web fallbacks)
- [x] release-please config + manifest; .github/dependabot.yml
- [x] CI workflow (lint → tsc → unit → build → playwright install → browser fixtures + screenshot artifacts → Android assembleDebug APK artifact)
- [x] release.yml + cd.yml deploying dist/ to GitHub Pages
- [ ] enable Pages via gh; README + CHANGELOG (README done)

## M0.5 — Real foundational subpackages (each = barreled package + tests, one commit)
- [ ] src/core/math: createRng (cyrb128→mulberry32), clock facade, spring/lerp/vec helpers + unit tests + barrel
- [ ] src/core/types: shared domain types/enums/ids + barrel
- [ ] src/ecs: koota world (done) + traits + queries + react hooks + barrel
- [ ] src/engine: fixed-timestep accumulator loop + world tick orchestration + unit tests + barrel
- [ ] src/state: game store (menu/playing/gameover) + settings + persistence bridge + tests + barrel
- [ ] src/input: @use-gesture + keyboard → intents + tests + barrel
- [ ] src/platform: Capacitor wrappers (haptics/orientation/keep-awake/preferences) + web fallbacks + barrel

## M1 — Design system & identity
- [ ] Design tokens (color/space/radius/shadow/motion/type) as CSS vars + TS token module + Tailwind theme; juicy gooey palette (not neon-cyberpunk)
- [ ] Unique Google Fonts pairing (display + UI) self-hosted via @fontsource or fontsource-variable; wire into tokens & Tailwind
- [ ] Brand-hex ban_patterns added to gates.json (enforce palette); STANDARDS.md brand section
- [ ] Loading screen, app icon / favicon, splash (blob identity)

## M2 — Core engine & deterministic sim
- [ ] RNG facade src/core/math/rng.ts (cyrb128 → mulberry32) + clock facade + unit tests
- [ ] Fixed-timestep engine loop (accumulator) driven from useFrame; koota world + traits
- [ ] Physics: @react-three/rapier world, gravity, blob rigidbody, kinematic trampolines
- [ ] Camera rig: vertical follow, FOV warp on launch, screen shake, look-ahead
- [ ] Input: @use-gesture/react unified pointer/touch + keyboard; slingshot vs air-steer modes

## M3 — Gooey blob (the star)
- [ ] Blob rendering: choose & implement (marching-cubes metaball vs distort-material sphere vs screen-space SDF) per goo prior-art findings; mobile-perf budget
- [ ] Squash-and-stretch deformation driven by velocity/impact; spring-back
- [ ] Jiggle / surface-tension wobble secondary motion
- [ ] Gooey surface shader: fresnel rim, translucency/subsurface approx, wet specular
- [ ] Blob skins/cores system (replaces PoC skins) using design tokens
- [ ] **Big expressive blinking eyes** (per hero-cover.png) — PROCEDURAL geometry, NOT sprites: big white distorted/stretched circles (sclera) with a bezel/rim ring + big black dot pupils, stretched onto the curved blob "face" and pushed into 3D. Responsive emotional states via scaling the eye meshes: idle blink (scaleY→0), squint on hard impact/squash, open WIDE on big launch/fast fall, tear up (droplet geo) when falling far / near death. Driven by velocity+impact state alongside squash-stretch. Core character juice.

## M4 — Trampolines & world
- [ ] Trampoline entity: spring depress (-k·x - c·v) + tilt on hit-angle, organic squishy mesh, goo smear
- [ ] Platform types: standard / booster / moving / fragile-shatter — reimagined as gooey
- [ ] Procedural vertical world generator (seeded), difficulty curve, ring/grid ambiance
- [ ] Crystals/collectibles + powerups (magnet, hyper-thrust) reimagined; pickup juice

## M5 — Goo VFX & juice (the messy fluidity)
- [ ] Gooey splash droplet system on every collision (metaball particles, colorful, gooey blending) — replaces PoC cubic sparks
- [ ] Splat decals on trampolines/surfaces (drei Decal or projected), fade/accumulate
- [ ] Wet goo trail behind blob; launch burst; combo flame; chromatic/glitch on big events
- [ ] @react-three/postprocessing stack: bloom, vignette, chromatic aberration, color grade, DOF, SSAO/N8AO tuned for soft glow
- [ ] anime.js + Motion micro-interactions across HUD/menus; haptics on mobile impacts

## M6 — Audio (Tone.js)
- [ ] Tone.js engine replacing PoC raw Web Audio: bounce/launch/chime/powerup/explode synths + procedural ambient pad/sequence
- [ ] Volume/BGM settings wired to design tokens & store; mute; audio-graph tests

## M7 — Game loop, UI, meta
- [ ] Game states (menu/playing/gameover) + store; HUD (altimeter, crystals, combo, powerup badges)
- [ ] Menus/modals via shadcn + Motion: main menu, settings, blob customizer, mechanics manual, game over
- [ ] Persistence (Capacitor Preferences/localStorage): best height, crystals, unlocked skins, settings
- [ ] Combo/multiplier + scoring; best-height records; juice on milestones

## M8 — Mobile & ship
- [ ] Safe-area insets, touch-first tuning, Pixel-5a perf pass (target 60fps), keep-awake/orientation
- [ ] Android build verified (assembleDebug), web build verified, Pages live & app RUNS (screenshot-verified)
- [ ] Quality pass: a11y, error states, perf budget, remove dead PoC references

## M9 — Docs (pillar + agentic + HADS)
- [ ] Pillar: README, docs/DESIGN.md (vision), docs/GAME-DESIGN.md (mechanics/physics constants/tuning), docs/ARCHITECTURE.md, docs/design-tokens + typography spec, CONTRIBUTING, STANDARDS, CHANGELOG, docs/TESTING, docs/DEPLOYMENT, docs/STATE
- [ ] Agentic: AGENTS.md, per-system READMEs, conventions, copilot-instructions, .cursor/rules
- [ ] HADS-format docs (token-efficient dual human+AI) via hads skill for the core specs
