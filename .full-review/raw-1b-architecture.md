# Phase 1B — Architecture Findings (architect-review, opus)

**Scope:** ~16.4k LOC, 231 files. Read-only.
**Verdict:** Strong. Clean `src/`↔`app/` direction, determinism boundary holds, renderer↔UI bridge real + documented, **zero circular deps** (`madge --circular` verified). Dominant problem: koota ECS is architecturally vestigial yet docs call it load-bearing.

## Critical
None.

## High

### H1. koota ECS world is vestigial — present but not wired as source of truth
**`src/ecs/world.ts`, `src/ecs/traits.ts`, `src/factories/blob.ts:14`, `app/scene/blob/PlayerBlob.tsx:107,443-445`, `src/sim/blob/entitySync.ts`**

- Of 7 declared traits, only `Blob`/`Transform`/`Velocity` on a single blob entity are spawned at runtime. `Trampoline`/`Crystal`/`PowerUp`/`Particle` never instantiated outside tests.
- The single blob entity is **write-only**: PlayerBlob writes `entity.set(...)` each frame but NOTHING reads traits back (`world.query`/`useTrait`/`entity.get` grep returns nothing outside tests).
- Real blob-state channel = imperative `getBlobDiagnostics()` (`src/state/diagnostics.ts`, 26 consumers). Real tower data = `useWorldStore` (`src/state/worldStore.ts`) plain arrays, not ECS.
- Per-frame `entity.set(...)` in hot loop = pure overhead feeding an unqueried store. The exact "dead despite deliberate" anti-pattern the doctrine forbids.

**Fix — pick ONE:** (a) WIRE it (matches doctrine): tower lives in ECS — `spawnTrampoline`/`spawnCrystal`/`spawnPowerUp` factories, field renderers + sim systems `world.query(...)` instead of `useWorldStore`; collapses `useWorldStore` into ECS. (b) CUT it honestly: delete koota, `src/ecs/**`, `factories/blob.ts`, `entitySync.ts`, the `koota` dep; update doctrine memory + ARCHITECTURE.md. Doctrine says koota intentional → (a) is in-spirit, but the limbo must end either way.

### H2. Docs assert ECS is queryable source of truth — it is not (spec drift)
**`docs/ARCHITECTURE.md:43,45`, `src/factories/blob.ts:7-9`, `src/sim/blob/entitySync.ts:6`, `app/scene/blob/PlayerBlob.tsx:432`**

Comments claim "queryable entity model" / "so systems + UI can query" / "queryable ECS source of truth." No system/UI queries it. Reconcile with whichever H1 path chosen.

## Medium

### M1. `src/systems/**` referenced by gates but doesn't exist
**`.claude/gates.json:15,33`** — gates+bans on `src/systems/**` but no such dir (sim logic in `src/sim/**`). Dead config / false enforcement coverage. **Fix:** consolidate globs on `src/sim/**`, or create `src/systems/` if H1a introduces real per-trait systems. Keep globs and dirs in lockstep.

### M2. State fragmented across 5 channels with no documented arbitration map
**`store.ts` (`useGameStore`), `worldStore.ts`, `diagnostics.ts`, `launchBridge.ts`, `powerupBridge.ts`, `flashBridge.ts`** — 2 zustand stores + 4 imperative singleton bridges. Each split individually well-reasoned + commented, but no doc states the partition rule, and the count creeps (`launchBridge`→`+powerupBridge`→`+flashBridge` = the "we ALSO need X" pattern). **Fix (doc only, not refactor):** add a partition table to ARCHITECTURE.md / `src/state/README.md`: human-cadence persisted→`useGameStore`; world arrays→`useWorldStore`; frame-cadence one-shots→bridges; + rule for when a new bridge is justified.

### M3. `PlayerBlob.tsx` is a 492-line god component (~6 responsibilities)
**`app/scene/blob/PlayerBlob.tsx`** — only file over 400 (under 600 warn but the outlier). Owns ECS lifecycle, Rapier body, diagnostics publishing, pad/rebound contact resolution (reads `useWorldStore` :316), power-up ticking, slow-mo dilation. **Fix:** extract pure helpers into `src/sim/blob/**` (contact/rebound next to `entitySync.ts`), leaving PlayerBlob a thin Rapier↔bridge adapter. (H1a removing dead ECS writes shrinks it on its own.) — overlaps Code-Quality H1.

## Low

- **L1** `src/state/diagnostics.ts:6` says "Dev tooling only" but is a PRODUCTION render dependency (26 consumers incl. `PostFX.tsx:43` chromatic aberration, GooCsg, CameraRig). Re-document as the production blob-render bridge.
- **L2** Library doctrine wiring: three-bvh-csg ✅ central; n8ao ✅ tier-gated; maath ✅ thin (single `damp`); **koota ❌ vestigial (H1)**.
- **L3** `src/state/persistence.ts:27` direct `useGameStore.setState` = standard zustand hydration pattern, acceptable. Single-source-of-truth otherwise intact (16 named actions).

## Invariant verification
| Invariant | Result |
|---|---|
| Determinism boundary | HOLDS (zero hits outside doc-comments; facades present; ban_patterns real) |
| Factories own spawning | HOLDS (only test `world.spawn`; `spawnBlob` sole runtime spawn) |
| Renderer↔UI bridge sole coupling | HOLDS (no three/scene import in `ui`/`views`; couples only via store/bridges) |
| No silent fallbacks (goo=CSG only) | HOLDS (single path GooCsg.tsx:35; `??` are config/Suspense not error-swallow) |
| Deliberate libs wired | PARTIAL (csg/n8ao/maath wired; koota vestigial) |
| Direction `src/`⇏`app/` | HOLDS (zero `app/` imports in `src/`) |
| Circular deps | NONE (`madge --circular` clean across 231 files) |

**Summary:** Bones are good. The one structural debt that matters is H1/H2 (koota limbo). M1 (dead gate) + M2 (undocumented state partition) are cheap doc/config reconciliations to land alongside.
