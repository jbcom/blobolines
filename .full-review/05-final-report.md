# Phase 5: Consolidated Review Report — blobolines

**Scope:** entire blobolines codebase (~16.4k LOC TS/TSX, 231 files).
This report consolidates findings across all 4 auditing phases (Code Quality, Architecture, Security, Performance, Testing, Documentation, Frameworks, and DevOps) to present a prioritized remediation backlog.

---

## Executive Summary

Blobolines is an **exceptionally well-disciplined, high-quality, and robustly tested codebase**. The determinism boundaries are strictly enforced, there are zero production stubs/TODOs, and the core gameplay is highly polished and responsive. 
There are **zero Critical (P0) security or stability vulnerabilities**. 

Remediation focus centers on **three major areas**:
1. **Performance & GC Churn (P1):** Real-time procedural geometry generation via CSG (`GooCsg.tsx`) and monolithic per-frame execution loops (`PlayerBlob.tsx`) put severe garbage collection pressure on mid-tier mobile environments.
2. **Architectural / Spec-Drift (P1):** The Koota ECS system is vestigial (write-only, never read during gameplay), which violates the "no dead code" and "no dead libraries" rules, while repository documentation still incorrectly claims it is the core "queryable source of truth".
3. **CI/CD Gaps (P1):** The critical Playwright E2E playable and route-proof tests are completely omitted from CI runs, and browser binaries are not cached.

---

## Core Findings Summary Table

| ID | Component | Severity | Description | Status |
|---|---|---|---|---|
| **PERF-H1** | Rendering (`GooCsg.tsx`) | **High (P1)** | Real-time CSG union & geometry disposal creates heavy GC churn | `[ ]` |
| **PERF-H2** | Simulation (`PlayerBlob.tsx`) | **High (P1)** | Monolithic, ~300-line monolithic `useFrame` hot-loop | `[ ]` |
| **AR-H1** | Architecture / ECS | **High (P1)** | Koota ECS is vestigial (write-only); dead deliberate library | `[ ]` |
| **TEST-H1** | CI/CD / DevOps | **High (P1)** | Playwright E2E tests are completely omitted from CI runs | `[ ]` |
| **SEC-M1** | Security / Pages | **Medium (P2)** | No Content Security Policy (CSP) headers on GitHub Pages | `[ ]` |
| **LANG-M1** | Framework / Vitest | **Medium (P2)** | Multiple Three.js instances imported in Vitest runners | `[ ]` |
| **CQ-M1** | Config / Physics | **Medium (P2)** | Gameplay-tuning magic numbers hardcoded in `PlayerBlob` | `[ ]` |
| **CQ-M2** | Math / Visuals | **Medium (P2)** | Duplicated "combo heat" formulas across frame components | `[ ]` |
| **CQ-M3** | Style / Layout | **Medium (P2)** | Unsafe repetitive `zIndex` castings in views | `[ ]` |
| **CQ-M4** | CSG / Tests | **Medium (P2)** | CSG depends on private `_hash` clear without guarding test | `[ ]` |
| **AR-M1** | CI / Gates | **Medium (P2)** | Dead `.claude/gates.json` path glob on non-existent directory | `[ ]` |
| **AR-M2** | State / Docs | **Medium (P2)** | State fragmented across 5 channels with no partition rules | `[ ]` |
| **SEC-L1** | Security / Views | **Low (P3)** | Dev harness query parameter `?dev` enabled in production | `[ ]` |
| **SEC-L3** | Security / Storage | **Low (P3)** | Persisted game state deserialized without schema validation | `[ ]` |
| **CQ-L1** | Types / Generator | **Low (P3)** | Unsafe cast-away-readonly mutations on DraftPad | `[ ]` |
| **CQ-L2** | Code / Generator | **Low (P3)** | 6-deep nested ternary in powerup generation | `[ ]` |
| **CQ-L3** | Sim / Physics | **Low (P3)** | `runHeightFromWorldY` closure hardcoded in R3F view | `[ ]` |
| **CQ-L4** | Architecture / Views | **Low (P3)** | Monolithic 338-line `GameOver.tsx` component | `[ ]` |

---

## Remediation Backlog Details

### High (P1)

#### 1. PERF-H1: Real-time CSG union & geometry disposal in `GooCsg.tsx`
- **Problem:** Dynamic metaball rendering evaluates a Constructive Solid Geometry (CSG) tree every frame to merge the central blob body with droplets and dynamic teardrop necks. While it avoids leaking memory, `three-bvh-csg`'s `evaluate()` allocates fresh `BufferGeometry` instances in the frame loop, causing substantial GC pressure and micro-stuttering on mobile.
- **Remediation Plan:** Refactor CSG chain to dynamically skip or slice droplet unions based on distance/weight, optimize `maxMerges` and `maxBridges` dynamically based on average frame time, and add a memory/geometry allocation leak assertion test.

#### 2. PERF-H2: Monolithic per-frame loop in `PlayerBlob.tsx`
- **Problem:** A massive, monolithic ~300-line `useFrame` callback coordinates powerup clocks, steering mechanics, wind hazards, downdrafts, near-miss sound sweeps, boundary limits, and landing events. This layout prevents caching optimizations, time-slicing of independent systems, and individual logic step testing.
- **Remediation Plan:** Refactor the loop by extracting separate, self-contained helper functions operating over a shared, typed context (e.g., `stepHazards`, `stepPowerups`, `stepLandings`, `stepNearMisses`).

#### 3. AR-H1 / DOC-H1: Vestigial Koota ECS & spec-drift
- **Problem:** Koota ECS represents a dead deliberate library. We write to a single blob entity but never read traits back; telemetry instead runs entirely on the Zustand stores and the diagnostics bridge. Yet, `ARCHITECTURE.md` still documents the ECS as the core queryable source of truth.
- **Remediation Plan:** Decide on a definitive architectural path:
  - *Option A:* Cleanly remove Koota ECS entirely and reconcile all files/docs to satisfy the "no dead code" and "no dead libraries" policies.
  - *Option B:* Fully wire gameplay systems and rendering through ECS queries as originally planned.
  - *Recommendation:* Cleanly remove Koota ECS (Option A). The Zustand store and direct diagnostics bridges are extremely fast, well-written, and fully verified; adding ECS queries introduces redundant runtime layers for a single-blob physics game. Update all architectural documents.

#### 4. TEST-H1 / DEV-H1: Missing Playwright E2E execution and caching in CI
- **Problem:** Playwright E2E tests (`pnpm test:e2e`), which contain the critical "is it playable?" gate and route-proof visual regression assertions, are completely omitted from `.github/workflows/ci.yml`. Furthermore, every CI build re-downloads and installs the Playwright Chromium binary from scratch, slowing down builds.
- **Remediation Plan:** Add a step to execute `pnpm test:e2e` in CI, and configure `actions/cache` to preserve Playwright's browser binaries matching the installed package version.

---

### Medium (P2)

#### 5. LANG-M1: Multiple Three.js instances imported in Vitest runners
- **Problem:** Vitest reports `THREE.WARNING: Multiple instances of Three.js being imported.` in unit and browser fixture runs. This happens because Vitest does not deduplicate the `three` module across separate dependencies, risking prototype-clash bugs (such as those affecting `three-bvh-csg`'s custom prototype properties).
- **Remediation:** Add `resolve: { dedupe: ["three"] }` to `vitest.config.ts` and `vitest.browser.config.ts` to align them with the production Vite build.

#### 6. SEC-M1: No Content Security Policy (CSP) headers on GitHub Pages
- **Problem:** The production Pages deployment lacks any CSP, raising the risk of future script-injection regressions.
- **Remediation:** Add a robust `<meta http-equiv="Content-Security-Policy" content="...">` tag to `index.html`, customized to support Rapier WASM execution (`script-src 'self' 'wasm-unsafe-eval'`), local web workers (`worker-src 'self' blob:`), and inline tokens.

#### 7. CQ-M1: Gameplay-tuning magic numbers hardcoded in `PlayerBlob`
- **Problem:** Crucial gameplay tuning constants (thruster velocity `34`, recovery jump `22`, perfect launch thresholds, bounds checks) are hardcoded directly in `PlayerBlob.tsx` instead of referencing the central `src/config/` files.
- **Remediation:** Move all gameplay numbers to `src/config/blob.json` or `src/config/launch.json` and type-bind them.

#### 8. CQ-M2: Duplicated "combo heat" formulas
- **Problem:** The visual combo-heat multiplier formula is duplicated with minor inconsistencies across `BlobFollowLight.tsx`, `TrajectoryPreview.tsx`, and `BlobTrail.tsx`.
- **Remediation:** Implement a single, unified `comboHeat(combo)` selector or helper function in `src/sim/combo` and import it.

#### 9. AR-M2: State fragmentation & lack of partition guidelines
- **Problem:** State is split across five distinct channels (2 Zustand stores, 3 bridges) with no documented partition boundaries, risking "bridge creep".
- **Remediation:** Document a state partitioning matrix in `ARCHITECTURE.md` or `src/state/README.md` to establish clear developer rules.

---

### Low (P3)

#### 10. SEC-L1 & SEC-L3: Production `?dev` escape & Unvalidated state deserialization
- **Problem:** The `?dev` parameter mounts the dev harness in production, allowing cheating. Storage is parsed with `JSON.parse` unchecked, exposing sessions to crash loops on corrupted settings.
- **Remediation:** Gate the `?dev` escape on `import.meta.env.DEV` so it tree-shakes out of production builds. Validate storage hydration via `zod` schemas, falling back gracefully to default configs.
