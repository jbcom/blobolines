# Phase 2B — Performance Engineering Audit

**Scope:** full codebase. React Three Fiber + Rapier physics + Three-BVH-CSG procedural rendering. Target platform includes mid-tier mobile devices via Capacitor.
**Verdict:** High performance standards overall, but significant structural hot-path pressure resides in procedural CSG geometry generation, memory allocations/GC pressure in the hot loop, and redundant ECS updates.

| Severity | Count | Findings |
|---|---|---|
| Critical | 0 | — |
| High | 2 | PERF-H1: Per-frame CSG union & geometry disposal in `GooCsg.tsx`<br>PERF-H2: Monolithic per-frame logic in `PlayerBlob.tsx` |
| Medium | 2 | PERF-M1: Wasted per-frame write overhead to vestigial Koota ECS<br>PERF-M2: High-frequency diagnostic state fan-out |
| Low | 2 | PERF-L1: Garbage collection pressure from array/vector allocations in frame loops<br>PERF-L2: Lack of dynamic low-FPS quality throttling |

---

## High

### PERF-H1 — Per-frame CSG union & geometry disposal in `GooCsg.tsx`
- **Location:** `app/scene/blob/GooCsg.tsx:162-316`
- **Details:** To render the gooey metaball mesh, `GooCsg` performs a chain of Constructive Solid Geometry (CSG) additions (`ADDITION` operator of `three-bvh-csg`) every single frame to merge the base blob with up to 10 droplets, 5 lobes, and dynamic teardrop bridge necks. 
  - Although the implementation has been carefully written to use a ping-ponging target buffer system (`ping`/`pong` `Brush` instances) and disposes of previous geometries to prevent memory leaks, `evaluator.evaluate()` still allocates new `BufferGeometry` instances internally on every call.
  - This results in substantial GC churn, allocating and deallocating megabytes of vertex and index buffers every second. On mid-tier Android devices running Capacitor, this causes visible micro-stuttering due to garbage collection pauses.
- **Recommended Fix:** 
  1. Optimize `maxMerges` and `maxBridges` dynamically based on actual frame-rate or tier settings.
  2. Implement a `PingPongUnion` helper to cleanly isolate the ping-ponging mechanics.
  3. Introduce a regression test/metric asserting that no un-disposed geometries leak over time during continuous CSG merges.

### PERF-H2 — Monolithic per-frame logic in `PlayerBlob.tsx`
- **Location:** `app/scene/blob/PlayerBlob.tsx:172-466`
- **Details:** The `useFrame` callback of `PlayerBlob` is a massive ~300-line monolithic loop. It coordinates a multitude of different systems on every frame: power-up ticking, double jumps, slicers/absorbers boundary logic, cloud adherence calculations, trajectory preview, wind hazards, downdrafts, patience calculations, wet trail particle generation, near-miss detections, lateral play boundaries, height-chasing, tower generation triggers, landing logic, and landing feedback processing.
  - This monolithic layout prevents any individual sub-system from being throttled (e.g., executing near-miss or wind-gust calculations every 2nd or 3rd frame instead of every frame).
  - It also makes code maintenance and testing of specific physics reactions difficult, leading to instruction-cache pressure on low-end CPUs.
- **Recommended Fix:** Refactor this monolithic callback by extracting separate, self-contained helper functions or system classes over a typed `FrameCtx` object (e.g., `stepPowerups`, `stepHazards`, `stepNearMisses`, `stepLandings`). This keeps the hook clean, improves readability, and permits future time-slicing/throttling.

---

## Medium

### PERF-M1 — Wasted per-frame write overhead to vestigial Koota ECS
- **Location:** `app/scene/blob/PlayerBlob.tsx:432`, `src/sim/blob/entitySync.ts:1-25`
- **Details:** On every frame, `PlayerBlob` updates the Koota ECS entity with the latest transform and velocity values. However, as noted in the Architecture Audit (AR-H1), the ECS subsystem is completely vestigial: the traits are never read by any system during actual gameplay.
  - These per-frame write operations (`entity.set(...)`) represent completely wasted CPU cycles, performing unnecessary object hashing, trait updates, and internal ECS bookkeeping in the most critical hot loop.
- **Recommended Fix:** Eliminate the per-frame Koota ECS updates entirely (or clean up Koota entirely if the "cut koota" path is chosen), or gate updates so they only run when a system is actually listening.

### PERF-M2 — High-frequency diagnostic state fan-out
- **Location:** `src/state/diagnostics.ts`
- **Details:** The game uses `getBlobDiagnostics()` as the primary bridge to pass frame-by-frame values (such as position, velocity, and expression) from the simulation to 26 different visual consumers (e.g., trail renderers, camera rig, post-processing speed effects).
  - If any of these visual consumers listen to this high-frequency bridge via standard React state triggers, they will trigger full React re-renders 60 to 120 times per second.
- **Recommended Fix:** Ensure that all 26 consumers access `getBlobDiagnostics()` using direct ref updates (pull-based) or through optimized Three.js/R3F frame loops, rather than React's `useState` or direct store subscriptions that force DOM reconciliation. Re-document this access pattern.

---

## Low

### PERF-L1 — Garbage collection pressure from array/vector allocations in frame loops
- **Location:** Multiple locations in `app/scene/**/*.tsx` and `src/sim/**/*.ts`
- **Details:** Small vector instantiations (e.g., `new Vector3()`, array spreads `[x, y, z]`, or distance calculations `Math.hypot(...)` creating temporary arrays) are present in various per-frame loops. While modern JS engines are highly optimized, continuous object allocations in the R3F/Rapier tick loops can degrade garbage collector performance over a long play session.
- **Recommended Fix:** Refactor loops to use pre-allocated static variables or scratch vectors (e.g., `tempVec3` or static object pools) for all local math calculations.

### PERF-L2 — Lack of dynamic low-FPS quality throttling
- **Location:** `src/render/qualityBridge.ts`, `app/scene/postfx/PostFX.tsx`
- **Details:** Quality settings (refraction, N8AO, Bloom) are set statically at game start or manually toggled in the Settings modal. If the game experiences a sudden drop in frame rate (e.g., due to background tasks on mobile), there is no automated heuristic to dynamically scale down the quality tier (e.g., disabling refraction or decreasing CSG `maxMerges`) to stabilize the frame rate.
- **Recommended Fix:** Implement a lightweight FPS monitor that can suggest or automatically trigger a dynamic quality scale-down if the average frame rate drops below 45 FPS for a prolonged period.
