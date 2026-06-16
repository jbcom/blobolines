# Blobolines Engineering Notes
**Version 1.0.0** · Blobolines · 2026 · HADS 1.0.0

---

## AI READING INSTRUCTION

Read `[SPEC]` and `[BUG]` blocks for authoritative facts — these are the hard-won,
verified engineering constraints of this codebase. Read `[NOTE]` only if a `[SPEC]`
is insufficient. `[?]` blocks are unverified hypotheses — treat with lower
confidence. Before changing the build config, the goo shaders, the physics window,
or the audio init, read the relevant `[BUG]` block first.

---

## 1. Build & Bundling

**[SPEC]**
- Package manager: **pnpm only**. Build: Vite 8 (rolldown).
- Commands: `pnpm dev`, `pnpm build`, `pnpm test` (unit, happy-dom),
  `pnpm test:browser` (Chromium WebGL fixtures), `pnpm lint` (Biome),
  `pnpm typecheck` (`tsc --noEmit`).
- `manualChunks` must be a **function** (rolldown rejects the object form).

**[BUG] Rapier `<Physics>` suspends forever**
- Symptom: `<Physics>` children never mount; no error, the tree just hangs suspended.
- Cause: Vite pre-bundling `@react-three/rapier` / `@dimforge/rapier3d-compat`
  mangles the WASM URL so the WASM init never resolves.
- Fix: `optimizeDeps.exclude: ['@react-three/rapier', '@dimforge/rapier3d-compat']`
  AND keep rapier in the single `three` prod chunk via `manualChunks`.
- Regression test: `app/scene/__tests__/physics.fixture.test.tsx` asserts a body
  actually falls under gravity.

**[BUG] Build fails parsing a GLSL string**
- Symptom: rolldown "Expected `,` or `)`" error pointing inside a shader file.
- Cause: a backtick character inside a GLSL comment terminates the JS template
  literal the shader lives in; the rest of the GLSL is then parsed as JavaScript.
- Fix: never use backticks in GLSL comments (or anywhere in the shader string).

---

## 2. Goo Rendering

**[SPEC]**
- Two goo paths: `GooMaterial` (tessellated sphere, vertex squash + wobble — the
  menu hero blob + fixtures) and `MetaballGooMaterial` (raymarched smin-metaball
  isosurface — the in-game blob, merges body + droplets).
- The metaball shader raymarches in **world space** (`ro = vWorldPos`).
- Combo flame is `u_heat` [0,1]; surface-tension jiggle is `u_wobble` [0,1].
- `MAX_GOO_BALLS = 24`, `MAX_STEPS = 48`.

**[BUG] Goo renders at the floor; eyes float above the blob**
- Symptom: the goo mesh draws near the world origin while the eyes sit where the
  blob actually is.
- Cause: metaball centers were packed **hull-local** while the shader raymarches in
  world space, pinning the whole field to the origin.
- Fix: `packMetaballField` packs **world-space** centers (`src/render/goo/metaballField.ts`).

**[BUG] Eyes occluded by the opaque goo**
- Symptom: eyes disappear behind the goo surface.
- Fix: render eyes with `depthTest: false` + a higher `renderOrder` so they draw on
  top of the goo face (`app/scene/blob/BlobEyes.tsx` / `GooField.tsx`).

**[BUG] Holes punched in the goo during a hard landing**
- Symptom: the metaball surface develops holes / missing pixels at peak wobble.
- Cause: the `u_wobble` displacement term adds spatial gradient to the SDF, raising
  its Lipschitz constant above 1; a full sphere-trace step then oversteps the surface.
- Fix: shorten the march step while wobble is active
  (`stepScale = 1/(1 + u_wobble*0.85)`) and keep the wobble amplitude ≤ 0.18 so the
  field stays safe at `MAX_STEPS = 48` (no extra steps needed). Full-speed march when
  cold (no idle perf cost).

**[BUG] Combo flame blows out to flat white**
- Symptom: at full combo the flame rim clamps to white and loses its warm hue.
- Cause: drei `shaderMaterial` renders outside the renderer's tonemapping pass, so
  HDR values >1 hard-clamp per channel.
- Fix: soft-clamp only the over-1.0 excess —
  `col = min(col,1) + over/(over+1)` where `over = max(col-1,0)`. Cold base goo
  (values <1) passes through untouched; the hot rim keeps its hue.

**[SPEC]**
- Hand-built materials are NOT auto-disposed by R3F. The owning component must call
  `material.dispose()` on unmount (respawn / skin swap / HMR) to avoid leaking GL
  programs.

---

## 3. Physics & World

**[SPEC]**
- `GRAVITY = [0,-22,0]`, blob radius `0.85` with CCD, `MAX_IMPACT_SPEED = 28`,
  `DEATH_FALL_DISTANCE = 24`, `WORLD_BOUND_XZ` clamps lateral play.
- `<Physics>` mounts only while playing; `PlayerBlob` remounts each run.
- Tower pads carry a stable `id` = generation Y (strictly increasing → unique;
  starter pad id = 0).

**[BUG] Climb-time frame hitch (p95 158ms under 6x CPU)**
- Symptom: long climbs spike frame time badly; steady-state is fine (p50 8.3ms).
- Cause: the trampoline list grew unbounded — every `ensureHeight` append
  re-rendered the whole map and mounted more Rapier bodies + per-pad splat canvases.
  The metaball raymarch is NOT the bottleneck.
- Fix: `TrampolineField` renders a bounded sliding window (40 below / 120 above the
  blob, re-evaluated only every 8 units of movement), keyed by stable pad id so
  culling reconciles instead of remounting. Result: p95 158ms → 16.9ms.

**[SPEC]**
- Window margins are safe: `WINDOW_BELOW (40) > DEATH_FALL_DISTANCE (24)`, so a live
  blob never reaches a culled pad; `WINDOW_ABOVE (120) >> WINDOW_STEP (8)`, so a
  fast-rising blob never outruns the mounted set.
- The trampoline impact sensor guards `other.isValid?.() === false` before reading a
  peer rigid body — the render window can unmount a pad's body mid-frame.

---

## 4. State & Frame Loop

**[SPEC]**
- Per-frame data (blob position/velocity/expression, launch/rebound/impact requests,
  power-up timers) flows through **imperative bridges** in `src/state`
  (`diagnostics.ts`, `launchBridge.ts`, `powerupBridge.ts`), read inside each
  component's `useFrame`. It NEVER goes through React state.
- React state (zustand) is for human-cadence changes only: phase, score, combo,
  settings.
- Out-of-hook reads use `useGameStore.getState()` (valid in `useFrame` / Rapier
  callbacks).

**[NOTE]**
The bridge pattern exists because a 60fps `setState` for blob position would trigger
60 re-renders/sec and tank the frame rate. Extend a bridge for new per-frame data
flow; do not add a zustand field the render loop writes every frame.

---

## 5. Audio

**[SPEC]**
- Tone.js, lazily initialized via `initAudio` from a user gesture (the PLAY click).
- SFX + music are silent no-ops until init resolves — safe to call early.
- `initAudio` is concurrency-safe (callers share one init promise).
- Buses: sfx + music under master; settings map onto gain nodes.

---

## 6. UI Animation & Dialogs

**[BUG] Dialog stuck off-center at opacity 0**
- Symptom: modal renders invisible and off-center.
- Cause: Motion cannot interpolate a `calc()`↔`%` transform; mixing centering and
  animation in one transform makes the whole `animate` object silently fail.
- Fix: static CSS centering on Radix `Content` (`-translate-x/y-1/2`); the inner
  `motion.div` animates only opacity + numeric y + scale.

**[SPEC]**
- Reduced motion: `<MotionConfig reducedMotion="user">` (all `motion.*`), a CSS
  `prefers-reduced-motion` kill-switch in `tokens.css`, and a `matchMedia` guard in
  the anime.js `usePunchOnChange` hook (Motion's config does not reach anime.js).
- The 3D `<canvas>` is `aria-hidden` + `tabIndex=-1`; the DOM HUD is the accessible
  surface. Altitude is a labelled group (NOT a live region — it changes per frame);
  crystals/combo/power-ups are polite live regions on their discrete changes.

---

## 7. Changelog

**[NOTE]**
- 1.0.0 (2026) — initial engineering notes captured during the goo-polish phase
  (Phase 2): goo VFX, wobble, perf window, a11y, error states.
