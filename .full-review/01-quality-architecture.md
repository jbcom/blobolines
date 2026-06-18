# Phase 1: Code Quality & Architecture Review

**Scope:** entire blobolines codebase (~16.4k LOC TS/TSX, 231 files). Both reviews read-only, opus.
Raw outputs: `raw-1a-code-quality.md`, `raw-1b-architecture.md`.

## Overall verdict
A **high-quality, well-disciplined codebase.** Determinism boundary holds and is enforced; no production TODO/FIXME/stubs; no genuine silent-fallback violations; zero circular dependencies; clean `src/`↔`app/` dependency direction; the renderer↔UI bridge is the sole coupling path. **No Critical findings in either review.** Debt concentrates in: (1) two per-frame god-functions, (2) the **vestigial koota ECS** subsystem whose docs misrepresent it as load-bearing, and (3) a cluster of low-severity consistency/doc items.

## Code Quality Findings (1A)

### High
- **CQ-H1** — `PlayerBlob` `useFrame` is a ~320-line god-function with 11+ responsibilities (`app/scene/blob/PlayerBlob.tsx:149-466`). Extract per-concern step helpers over a typed `FrameCtx`, preserving ordering.
- **CQ-H2** — `GooCsg` `useFrame` couples FBO refraction, CSG mesh assembly, deform springs in 220 lines with 3 manual GPU-leak-prevention dances and no leak test (`app/scene/blob/GooCsg.tsx:160-382`). Split + `PingPongUnion` helper + geometry-bound regression test.

### Medium
- **CQ-M1** — Gameplay-tuning magic numbers hardcoded in `PlayerBlob`, bypassing `src/config`/`src/sim/physics.ts` (thruster 34, mid-air 22, shield 18, charge 0.35, etc.).
- **CQ-M2** — Duplicated "combo heat" across 3 frame components with **different formulas** (latent visual-inconsistency bug): `BlobFollowLight.tsx:27-28`, `TrajectoryPreview.tsx:41`, `BlobTrail.tsx:93-94`. One `comboHeat()` selector.
- **CQ-M3** — `zIndex: "var(--z-x)" as unknown as number` repeated 3× (`Game.tsx:71`, `ScreenFlash.tsx:82`, `SpeedLines.tsx:63`); switch to the `className="z-[var(...)]"` form used elsewhere.
- **CQ-M4** — CSG correctness depends on clearing `three-bvh-csg`'s private `_hash` with no guarding test (`GooCsg.tsx:227-238`). Add GooCsg fixture test (no fallback exists by design).

### Low
- **CQ-L1** `generator.ts:49,63` cast-away-readonly mutation → `DraftPad` type.
- **CQ-L2** `generator.ts:185-196` 6-deep ternary → `pickPowerUpType(rng)`.
- **CQ-L3** `PlayerBlob.tsx:102` `runHeightFromWorldY` pure closure → `src/sim`.
- **CQ-L4** `GameOver.tsx` 338-line component → extract `useGameOverState()` hook.
- **CQ-L5** `as unknown as ShaderMaterial` (GooCsg:85, BlobActor:48) — forced drei limitation, optional typed wrapper.

## Architecture Findings (1B)

### High
- **AR-H1** — **koota ECS is vestigial**: single write-only blob entity, no runtime trait reads, 4 of 7 traits never spawned outside tests; real channels are `getBlobDiagnostics()` (26 consumers) + `useWorldStore` arrays. Violates the "no dead deliberate libs" doctrine. **Decide: (a) wire the tower through ECS, or (b) cut koota + reconcile docs.** (a) is in-spirit.
- **AR-H2** — Docs/comments assert ECS is the "queryable source of truth" — it isn't (`ARCHITECTURE.md:43,45`, `entitySync.ts:6`, `PlayerBlob.tsx:432`, `factories/blob.ts:7-9`). Spec drift; reconcile with H1 path.

### Medium
- **AR-M1** — `src/systems/**` referenced by `.claude/gates.json:15,33` but the dir doesn't exist → dead gate / false enforcement coverage. Consolidate globs on `src/sim/**` or create the dir.
- **AR-M2** — State fragmented across 5 channels (2 zustand stores + 4 bridges) with no documented partition rule; bridge count creeping. **Doc fix:** partition table in ARCHITECTURE.md / `src/state/README.md` + new-bridge justification rule.
- **AR-M3** — `PlayerBlob.tsx` 492-line god component (~6 responsibilities). Extract contact/rebound + powerup helpers to `src/sim/blob/**`. **Overlaps CQ-H1** — fix together.

### Low
- **AR-L1** `diagnostics.ts:6` "Dev tooling only" is stale — it's the production blob-render bridge (26 consumers incl. PostFX chromatic aberration). Re-document.
- **AR-L2** Library wiring: csg ✅ central, n8ao ✅ tier-gated, maath ✅ thin, koota ❌ (see H1).
- **AR-L3** `persistence.ts:27` direct `setState` = standard zustand hydration, acceptable.

### Invariants verified
Determinism boundary HOLDS · Factories own spawning HOLDS · Renderer↔UI bridge sole coupling HOLDS · No silent fallbacks HOLDS · `src/`⇏`app/` HOLDS · Circular deps NONE · Deliberate libs PARTIAL (koota vestigial).

## Critical Issues for Phase 2 Context
- **No security-relevant Critical/High** surfaced in Phase 1 — codebase is a client-side game (no server, no auth) so the security surface is narrow; Phase 2 should focus on: dependency CVEs, the Capacitor native bridge surface, persistence/storage of user data, any `dangerouslySetInnerHTML`/eval/dynamic-import, CSP/headers for the Pages deploy, and the WASM (Rapier) loading path.
- **Performance hot-path candidates for Phase 2:** the two per-frame god-functions (CQ-H1/H2), the per-frame CSG union + geometry disposal in `GooCsg` (GPU memory pressure on mid-tier mobile — the stated render budget target), the per-frame dead ECS `entity.set` writes (AR-H1, wasted hot-loop work), and the per-frame `getBlobDiagnostics` fan-out to 26 consumers. Mobile render budget (Pixel 5a class) is the stated constraint.
