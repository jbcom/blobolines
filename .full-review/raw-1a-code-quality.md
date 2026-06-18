# Phase 1A — Code Quality Findings (code-reviewer, opus)

**Scope:** entire blobolines codebase, 16,446 lines TS/TSX. Read-only.

## Executive Summary

High-quality, well-disciplined codebase. Conventions honored: `src/sim/**` and `src/engine/**` are pure (zero `Math.random()`/`performance.now()` outside RNG/clock facades — grep-verified), no production TODO/FIXME/stub markers, ErrorBoundary wraps app, persistence surfaces failures loudly, every `as any`/`as unknown as` is a forced ecosystem cast. **No Critical. No genuine silent-fallback violations** (all `catch {}` are documented feature-detection no-ops).

Findings concentrate in: (1) cognitive complexity of two per-frame god-functions, (2) low-severity maintainability/consistency items.

## High

### H1. `PlayerBlob`'s `useFrame` is a ~320-line god-function (11+ responsibilities)
**`app/scene/blob/PlayerBlob.tsx:149-466`**

One `useFrame` owns: delta clamp, power-up tick, thruster hold, mid-air bounce, rebound/combo, launch, air-steer+wind+downdraft, auto-launch-on-idle, goo trail, near-miss whoosh, world-bound clamp, height-chase + tower extension, landing impact+haptics+splat, danger heartbeat, diagnostics bridge write, ECS projection, death/shield. Correct + well-commented but cannot be held in head. Blocks subtly interact via `playerControlStarted` ref and the "re-read live vy" caveat at `:283`.

**Fix:** Extract per-concern step helpers (`stepRebound`, `stepLaunch`, `stepAutoLaunch`, `stepNearMiss`, `stepLandingImpact`, `stepDanger`, `stepDeath`) taking a small typed `FrameCtx`; keep `useFrame` as thin orchestrator preserving exact ordering.

### H2. `GooCsg`'s `useFrame` couples FBO mgmt, CSG mesh assembly, deform springs (220 lines)
**`app/scene/blob/GooCsg.tsx:160-382`**

Interleaves: (1) half-res backbuffer FBO refraction pass `:165-190`, (2) per-frame CSG union chain with manual geometry-disposal + `_hash=null` BVH workaround `:204-292`, (3) wet-wobble/squash/lean/puddle springs `:294-381`. The CSG block hides 3 manual GPU-leak-prevention dances with no test asserting "no geometry leaked per frame."

**Fix:** Split into `renderBackbuffer`/`buildGooMesh`/`applyDeform`; move dispose bookkeeping into a `PingPongUnion` helper. Add fixture test running N frames asserting `renderer.info.memory.geometries` stays bounded.

## Medium

### M1. Gameplay-tuning magic numbers hardcoded in `PlayerBlob`, bypassing `src/config`
**`app/scene/blob/PlayerBlob.tsx`** — thruster hold `y:34` (:169), mid-air-bounce `y:22` (:179), shield-save pop `y:18` (:455), auto-launch charge `0.35` (:291), combo-flash `>=3` (:227), near-miss band `half+0.4…+2.5` (:327), wall-bounce damp `*0.5` (:344), impact-decay `*2.5` (:396), danger heartbeat `0.45 - danger*0.33` (:411). `src/sim/physics.ts` already exports `BLOB`, `AUTO_LAUNCH_DELAY` — these belong there too.

### M2. Duplicated "combo heat" read + computation across 3 frame components — with DIFFERENT formulas (latent bug)
**`app/scene/world/BlobFollowLight.tsx:27-28`, `app/scene/blob/TrajectoryPreview.tsx:41`, `app/scene/blob/BlobTrail.tsx:93-94`**

`(combo-2)/6` clamped vs `combo/MAX_COMBO` — two curves that should agree but don't. **Fix:** one `comboHeat(combo)` selector in `src/sim/combo.ts`.

### M3. `zIndex: "var(--z-x)" as unknown as number` repeated 3×
**`app/Game.tsx:71`, `app/views/hud/ScreenFlash.tsx:82`, `app/views/hud/SpeedLines.tsx:63`**

Other components use the clean `className="z-[var(--z-modal)]"` form. **Fix:** switch these 3 to className form (preferred) or add a `zVar()` helper.

### M4. CSG correctness rests on internal-library workaround with no guarding test
**`app/scene/blob/GooCsg.tsx:227-238`**

`unionInto` clears `three-bvh-csg` private `_hash` to force BVH rebuild. Correct + documented but depends on a private field under "latest-everything" policy — a minor bump could silently break the only goo path (no fallback by design). **Fix:** add GooCsg fixture test (harness exists) rendering ≥2 frames with active droplet merges, asserting no throw + valid bounds tree.

## Low

- **L1** `src/world/generator.ts:49,63` — `ensureReachable` mutates `prev` via cast-away-readonly. Model a mutable `DraftPad` frozen into `TrampolineSpec` on push.
- **L2** `src/world/generator.ts:185-196` — 6-deep nested ternary for power-up rarity; extract `pickPowerUpType(rng)` to match existing `pickPadType`/`pickCrystalTier`.
- **L3** `app/scene/blob/PlayerBlob.tsx:102` — `runHeightFromWorldY` pure closure re-created each render; belongs in `src/sim`.
- **L4** `app/views/GameOver.tsx` — 338-line component mixing share/achievement-diff/record/keyboard/JSX; extract `useGameOverState()` hook. `catch {}` at :116 correctly documented (user-cancelled share).
- **L5** `app/scene/blob/GooCsg.tsx:85`, `BlobActor.tsx:48` — `as unknown as ShaderMaterial` forced by drei `shaderMaterial()` ecosystem limitation, not a defect. Optional: one typed wrapper.

## Verified Clean
- Determinism boundary holds (grep-verified).
- No silent fallbacks (all `catch {}` documented).
- No stubs/TODOs/dead code in production.
- ErrorBoundary present + tested.
- `launchBridge.ts` singletons = intentional documented consume-once bridge pattern.
- `howler.ts` (344 lines) = ~30 small single-purpose functions, low complexity.
- State persistence = real Capacitor Preferences, proper hydrate/merge/subscribe.

**Bottom line:** H1/H2 (decompose frame god-functions) primary win; M4 (CSG regression test) protects no-fallback goo path; fold M1–M3 into same pass; Low items are polish.
