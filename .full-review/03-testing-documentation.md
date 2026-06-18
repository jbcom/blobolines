# Phase 3: Testing & Documentation Review

**Scope:** entire blobolines codebase (~16.4k LOC TS/TSX, 231 files).
Raw outputs: `raw-3a-testing.md`, `raw-3b-documentation.md`.

## Overall verdict
The codebase maintains **world-class testing infrastructure and clean architectural documentation.** Deterministic RNG testing is superb, and real WebGL-based browser fixtures represent an elite tier of web-game quality assurance.
However, **specification drift and execution gaps** weaken this foundation. The critical finding is that the Playwright E2E tests—the actual "is it playable?" gate—are **completely omitted from CI execution**, despite docs claiming otherwise. Additionally, the repository's core documentation has drifted severely regarding Koota ECS, falsely claiming it as a runtime source of truth.

---

## Testing Findings (3A)

### High
- **TEST-H1** — **Playwright E2E tests completely omitted from CI pipeline**: While `docs/TESTING.md` states that E2E tests run in CI on every PR, `.github/workflows/ci.yml` never executes them. This means critical playable regression tests are unchecked during PR validation, exposing main to silent startup or physics crashes.

### Medium
- **TEST-M1** — **Gaps in automated audio interaction verification in browser environments**: Automated visual browser tests cannot trigger real audio playback due to autoplay blocks, and they lack spied/mocked assertions to verify that audio triggers (like launch, thump, or combo sounds) are actually invoked under appropriate conditions.

### Low
- **TEST-L1** — **Lack of E2E artifact archiving and reporting in CI**: Upon failing a headless E2E run, there is no automatic upload or archiving of Playwright HTML reports, videos, or traces in the CI artifacts, making headless failures hard to troubleshoot.
- **TEST-L2** — **Hardware/GPU flakiness in browser fixture test environments**: The WebGL browser tests can occasionally fail on standard resource-constrained GitHub runner agents. Graceful WebGL context loss recovery is unasserted.

---

## Documentation Findings (3B)

### High
- **DOC-H1** — **Architectural spec-drift regarding Koota ECS**: `docs/ARCHITECTURE.md` and several code comments falsely claim that Koota ECS is the active queryable source of truth. In reality, ECS is vestigial (never read during gameplay), with visual states and rendering instead relying on Zustand stores and the `getBlobDiagnostics()` bridge.

### Medium
- **DOC-M1** — **No partition guidelines for state management channels**: There is no documented division of responsibility explaining when to utilize Zustand stores (`useGameStore`, `useWorldStore`) versus transient state bridges (`launchBridge`, `powerupBridge`). This leads to "bridge creep" and architectural inconsistency.

### Low
- **DOC-L1** — **Stale "Dev tooling only" tag on `diagnostics.ts`**: Header comments in `diagnostics.ts` claim it is dev-only, despite it being the primary production visual channel driving 26 visual and postfx consumers.

---

## Invariants verified
- Determinism is tested & verified **HOLDS** · Visual-regression screenshots captured **HOLDS** · Audio unit test coverage **HOLDS** · Documentation mapped to structure **HOLDS** (but content has drifted).

---

## Critical Issues for Phase 4 Context
- **Framework & CI/CD focus for Phase 4:** Leverage the findings from Phase 2 and 3 to ensure that the CI build is fully hardened, and look for Vite build configurations or TS configurations that could be optimized to resolve potential multi-import Three.js warnings seen in tests.
