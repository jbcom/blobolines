# Phase 3A — Testing Audit

**Scope:** full codebase. Vitest unit tests, Vitest browser/WebGL fixture tests, and Playwright E2E integration tests.
**Verdict:** Outstanding test architecture with multi-layered verification (unit, real WebGL browser fixtures, and full E2E run). However, a major regression-testing gap exists where the E2E tests are completely missing from CI execution, and browser tests lack deep audio interaction mocking.

| Severity | Count | Findings |
|---|---|---|
| Critical | 0 | — |
| High | 1 | TEST-H1: Playwright E2E tests completely omitted from CI pipeline |
| Medium | 1 | TEST-M1: Gaps in automated audio interaction verification in browser environments |
| Low | 2 | TEST-L1: Lack of E2E artifact archiving and reporting in CI<br>TEST-L2: Hardware/GPU flakiness in browser fixture test environments |

---

## High

### TEST-H1 — Playwright E2E tests completely omitted from CI pipeline
- **Location:** `.github/workflows/ci.yml`, `docs/TESTING.md:10`
- **Details:** `docs/TESTING.md` explicitly states: *"Three layers, each catching a different class of bug. All run in CI on every PR."* However, `.github/workflows/ci.yml` never executes `pnpm test:e2e` (the command for running Playwright).
  - This means the crucial **"is it playable?" gate** (`e2e/playable.spec.ts`) and the dev-only **route proof sequence verification** (`e2e/route-proof.spec.ts`) are never executed on PRs or on merging to `main`.
  - Breaking changes that prevent the game from starting, the physics from initializing, or the altitude from climbing can be merged without triggering any CI failures.
- **Recommended Fix:** Add a step to `.github/workflows/ci.yml` after the browser fixture tests to run `pnpm test:e2e`. Ensure Playwright dependencies are correctly cached.

---

## Medium

### TEST-M1 — Gaps in automated audio interaction verification in browser environments
- **Location:** `src/audio/__tests__/*.ts`, `app/scene/blob/__tests__/*.fixture.test.tsx`
- **Details:** The audio subsystem uses Howler.js and is covered by unit tests asserting the "before-init no-op contract". However, during browser fixture and E2E tests, the browser's autoplay block policy prevents real audio nodes from playing without a user gesture.
  - While this is expected browser behavior, there are no mock/spy assertions in the visual/browser tests to verify that `playLaunch()`, `playThump()`, or combo blips are actually being triggered under correct gameplay conditions.
  - A regression that silences audio calls during active gameplay could easily slip by unnoticed.
- **Recommended Fix:** Introduce spies or mock verifications in browser fixture tests (e.g., in `GooCsg.fixture.test.tsx` or `LaunchInput.browser.test.tsx`) to assert that the sound trigger functions are executed with the expected arguments.

---

## Low

### TEST-L1 — Lack of E2E artifact archiving and reporting in CI
- **Location:** `.github/workflows/ci.yml`
- **Details:** When Playwright E2E tests are added to CI, any failure on a headless runner will be difficult to diagnose without the corresponding visual artifacts. Currently, the workflow has an upload step for `__screenshots__/` but lacks archiving for Playwright's HTML reports, trace files, or test videos.
- **Recommended Fix:** Add an `upload-artifact` step specifically for `playwright-report/` or equivalent traces/videos upon test failure in the workflow file.

### TEST-L2 — Hardware/GPU flakiness in browser fixture test environments
- **Location:** `vitest.browser.config.ts`, `app/fixtures/FixtureStage.tsx`
- **Details:** The WebGL-based browser fixture tests rely on the system's GPU capabilities. In resource-constrained CI agents (e.g., GitHub's standard `ubuntu-latest`), WebGL context loss or resource limits can occasionally cause intermittent browser-fixture failures.
- **Recommended Fix:** Ensure that `FixtureStage` handles WebGL context-loss events gracefully or includes retries for WebGL-dependent tests in `vitest.browser.config.ts`.
